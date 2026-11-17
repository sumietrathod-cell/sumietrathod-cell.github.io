// Supabase Edge Function: authenticated, RLS-scoped starter API.
// Deploy with Supabase CLI after staging project configuration.
// Never add a service-role key to this function or browser bundle.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "https://aarohanaiworld.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Vary": "Origin",
};

function reply(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") return reply({ error: "Method not allowed" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return reply({ error: "Authentication required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return reply({ error: "Server configuration incomplete" }, 503);

  // User-scoped client: all database access is subject to the caller's RLS policies.
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return reply({ error: "Invalid or expired session" }, 401);
  const user = authData.user;

  const url = new URL(req.url);
  if (req.method === "GET" && url.pathname.endsWith("/me")) {
    const { data: memberships, error } = await supabase
      .from("organization_members")
      .select("organization_id, role, organizations(name)")
      .eq("user_id", user.id);
    if (error) return reply({ error: "Unable to load memberships" }, 403);
    return reply({ user: { id: user.id, email: user.email ?? null }, organizations: memberships ?? [] });
  }

  if (req.method === "GET" && url.pathname.endsWith("/campaigns")) {
    const orgId = url.searchParams.get("organization_id");
    if (!isUuid(orgId)) return reply({ error: "Valid organization_id is required" }, 400);
    const { data, error } = await supabase
      .from("campaigns")
      .select("id, name, goal, channel, status, timezone, dry_run, created_at, updated_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return reply({ error: "Unable to load campaigns" }, 403);
    return reply({ campaigns: data ?? [] });
  }

  if (req.method === "POST" && url.pathname.endsWith("/campaigns")) {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return reply({ error: "Request body must be valid JSON" }, 400);
    }
    const { organization_id, name, goal, channel, timezone } = body;
    if (!isUuid(organization_id)) return reply({ error: "Valid organization_id is required" }, 400);
    if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 120)
      return reply({ error: "Campaign name must be 2–120 characters" }, 400);
    if (typeof goal !== "string" || goal.trim().length < 2 || goal.trim().length > 1000)
      return reply({ error: "Campaign goal must be 2–1000 characters" }, 400);
    if (channel !== "voice" && channel !== "whatsapp" && channel !== "manual")
      return reply({ error: "Unsupported channel" }, 400);
    if (timezone !== undefined && (typeof timezone !== "string" || timezone.length > 64))
      return reply({ error: "Invalid timezone" }, 400);

    // Membership and role are checked with the caller's JWT before insert.
    const { data: membership, error: memberError } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organization_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (memberError || !membership || !["owner", "admin", "operator"].includes(membership.role))
      return reply({ error: "You do not have permission to create campaigns in this organization" }, 403);

    const { data: campaign, error } = await supabase
      .from("campaigns")
      .insert({
        organization_id,
        name: name.trim(),
        goal: goal.trim(),
        channel,
        timezone: typeof timezone === "string" ? timezone : "Asia/Kolkata",
        dry_run: true,
        status: "draft",
        created_by: user.id,
      })
      .select("id, name, goal, channel, status, timezone, dry_run, created_at")
      .single();
    if (error) return reply({ error: "Campaign could not be created" }, 400);
    return reply({ campaign, message: "Draft created in dry-run mode. No outreach was sent." }, 201);
  }

  return reply({ error: "Route not found" }, 404);
});
