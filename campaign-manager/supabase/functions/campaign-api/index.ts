import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const APP_ORIGIN = Deno.env.get("APP_ORIGIN") ?? "";

const json = (body: unknown, status = 200, origin = APP_ORIGIN) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": origin,
      "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "vary": "Origin",
    },
  });

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !APP_ORIGIN) {
    return json({ error: "Server configuration is incomplete." }, 500);
  }
  if (origin && origin !== APP_ORIGIN) return json({ error: "Origin not allowed." }, 403);
  if (req.method === "OPTIONS") return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": APP_ORIGIN,
      "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "vary": "Origin",
    },
  });

  const authorization = req.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return json({ error: "Authentication required." }, 401);

  // Use the caller's JWT and anon key. Never use a service-role key in this customer API.
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return json({ error: "Invalid or expired access token." }, 401);

  const url = new URL(req.url);
  const route = url.pathname.replace(/\/$/, "").split("/").slice(-1)[0];

  if (req.method === "GET" && route === "me") {
    const { data, error } = await supabase
      .from("organization_members")
      .select("organization_id, role, organizations(name)")
      .eq("user_id", authData.user.id);
    if (error) return json({ error: "Could not load memberships." }, 403);
    return json({ user: { id: authData.user.id, email: authData.user.email }, memberships: data ?? [] });
  }

  if (req.method === "GET" && route === "campaigns") {
    const organizationId = url.searchParams.get("organization_id");
    if (!organizationId) return json({ error: "organization_id is required." }, 400);
    const { data, error } = await supabase
      .from("campaigns")
      .select("id, name, goal, channel, status, dry_run, created_at, updated_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return json({ error: "Could not load campaigns." }, 403);
    return json({ campaigns: data ?? [] });
  }

  if (req.method === "POST" && route === "campaigns") {
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }
    const organizationId = typeof body.organization_id === "string" ? body.organization_id : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const goal = typeof body.goal === "string" ? body.goal.trim() : "";
    const channel = body.channel;
    const timezone = typeof body.timezone === "string" ? body.timezone : "Asia/Kolkata";
    if (!organizationId || !name || !goal || name.length > 120 || goal.length > 1000 ||
        !["voice", "whatsapp", "manual"].includes(String(channel))) {
      return json({ error: "Valid organization_id, name, goal and channel are required." }, 400);
    }
    // RLS enforces membership and operator-level permissions. New campaigns remain drafts.
    const { data, error } = await supabase.from("campaigns").insert({
      organization_id: organizationId,
      name,
      goal,
      channel,
      timezone,
      status: "draft",
      dry_run: true,
      created_by: authData.user.id,
    }).select("id, name, goal, channel, status, dry_run, created_at").single();
    if (error) return json({ error: "Campaign could not be created. Check organization access and role." }, 403);
    return json({ campaign: data }, 201);
  }

  return json({ error: "Route not found." }, 404);
});
