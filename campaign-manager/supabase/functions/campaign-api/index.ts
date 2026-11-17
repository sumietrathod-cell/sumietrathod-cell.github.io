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
  const segments = url.pathname.replace(/\/$/, "").split("/").filter(Boolean);
  const route = segments[segments.length - 1];

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


  // CSV import is limited to draft campaigns and never starts outreach.
  if (req.method === "POST" && segments.length >= 4 &&
      segments[segments.length - 1] === "import" &&
      segments[segments.length - 2] === "contacts" &&
      segments[segments.length - 4] === "campaigns") {
    const campaignId = segments[segments.length - 3];
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(campaignId)) {
      return json({ error: "Invalid campaign id." }, 400);
    }
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id, organization_id, channel, status, dry_run")
      .eq("id", campaignId)
      .single();
    if (campaignError || !campaign) return json({ error: "Campaign not found or access denied." }, 404);
    if (!["voice", "whatsapp"].includes(campaign.channel)) {
      return json({ error: "CSV permission import currently supports voice or WhatsApp campaigns only." }, 400);
    }
    if (campaign.status !== "draft" || campaign.dry_run !== true) {
      return json({ error: "Contacts can only be imported into a draft dry-run campaign." }, 409);
    }

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ error: "Send JSON containing csv_text." }, 400); }
    const csv = typeof body.csv_text === "string" ? body.csv_text : "";
    if (!csv || csv.length > 1_000_000) return json({ error: "CSV is required and must be at most 1 MB." }, 413);

    // Small RFC-4180-style parser supporting quoted commas, escaped quotes and CRLF.
    const parseCsv = (input: string): string[][] => {
      const rows: string[][] = [];
      let row: string[] = [], cell = "", quoted = false;
      for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        if (quoted) {
          if (ch === '"' && input[i + 1] === '"') { cell += '"'; i++; }
          else if (ch === '"') quoted = false;
          else cell += ch;
        } else if (ch === '"' && cell.length === 0) quoted = true;
        else if (ch === ",") { row.push(cell); cell = ""; }
        else if (ch === "\n" || ch === "\r") {
          if (ch === "\r" && input[i + 1] === "\n") i++;
          row.push(cell); cell = "";
          if (row.some((v) => v.trim() !== "")) rows.push(row);
          row = [];
        } else cell += ch;
      }
      if (quoted) throw new Error("CSV contains an unclosed quoted field.");
      row.push(cell);
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      return rows;
    };

    let rows: string[][];
    try { rows = parseCsv(csv); } catch (e) { return json({ error: (e as Error).message }, 400); }
    if (rows.length < 2) return json({ error: "CSV must contain a header and at least one contact row." }, 400);
    if (rows.length > 501) return json({ error: "A maximum of 500 contacts can be imported per request." }, 413);
    const headers = rows[0].map((h) => h.trim().toLowerCase());
    const required = ["full_name", "phone_e164", "email", "consent_status", "consent_evidence"];
    if (!required.every((h) => headers.includes(h))) {
      return json({ error: "Required CSV headers: full_name, phone_e164, email, consent_status, consent_evidence." }, 400);
    }
    const index = Object.fromEntries(headers.map((h, i) => [h, i]));
    const result = { imported: 0, consent_granted: 0, rejected: 0, rows: [] as Array<Record<string, unknown>> };
    const seen = new Set<string>();

    for (let i = 1; i < rows.length; i++) {
      const values = rows[i];
      const get = (key: string) => (values[index[key]] ?? "").trim();
      const fullName = get("full_name").slice(0, 160);
      const phone = get("phone_e164");
      const email = get("email").slice(0, 254);
      const consentStatus = get("consent_status").toLowerCase();
      const consentEvidence = get("consent_evidence").slice(0, 500);
      const rowNumber = i + 1;

      if (!/^\+[1-9]\d{7,14}$/.test(phone) || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
        result.rejected++;
        result.rows.push({ row: rowNumber, status: "rejected", reason: "Use a valid E.164 phone number and valid email if supplied." });
        continue;
      }
      if (seen.has(phone)) {
        result.rejected++;
        result.rows.push({ row: rowNumber, status: "rejected", reason: "Duplicate phone number in this CSV." });
        continue;
      }
      seen.add(phone);
      const granted = consentStatus === "granted" && consentEvidence.length > 0;
      const permissionStatus = granted ? "granted" : "unknown";

      const { data: existing } = await supabase.from("contacts")
        .select("id").eq("organization_id", campaign.organization_id).eq("phone_e164", phone).maybeSingle();
      let contactId = existing?.id as string | undefined;
      if (!contactId) {
        const { data: created, error: createError } = await supabase.from("contacts").insert({
          organization_id: campaign.organization_id,
          full_name: fullName || null,
          phone_e164: phone,
          email: email || null,
          source: "csv_import",
        }).select("id").single();
        if (createError || !created) {
          result.rejected++;
          result.rows.push({ row: rowNumber, status: "rejected", reason: "Contact could not be saved; check permissions and duplicate records." });
          continue;
        }
        contactId = created.id;
      }

      const { error: permissionError } = await supabase.from("contact_channel_permissions").upsert({
        organization_id: campaign.organization_id,
        contact_id: contactId,
        channel: campaign.channel,
        permission_status: permissionStatus,
        evidence_reference: granted ? consentEvidence : null,
        captured_at: granted ? new Date().toISOString() : null,
        captured_by: authData.user.id,
      }, { onConflict: "contact_id,channel" });
      if (permissionError) {
        result.rejected++;
        result.rows.push({ row: rowNumber, status: "rejected", reason: "Contact saved, but channel permission record failed. Review this contact before use." });
        continue;
      }

      const { error: enrollError } = await supabase.from("campaign_contacts").upsert({
        organization_id: campaign.organization_id,
        campaign_id: campaign.id,
        contact_id: contactId,
        status: "queued",
      }, { onConflict: "campaign_id,contact_id", ignoreDuplicates: true });
      if (enrollError) {
        result.rejected++;
        result.rows.push({ row: rowNumber, status: "rejected", reason: "Contact and permission saved, but campaign enrollment failed." });
        continue;
      }
      result.imported++;
      if (granted) result.consent_granted++;
      result.rows.push({ row: rowNumber, status: "imported", permission: permissionStatus });
    }
    return json({ ...result, note: "Import only stores contacts and permission evidence. It does not send calls or messages; unknown permission is not consent." }, 200);
  }

  return json({ error: "Route not found." }, 404);
});
