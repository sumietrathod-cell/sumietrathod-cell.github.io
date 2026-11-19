import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const APP_ORIGIN = Deno.env.get("APP_ORIGIN") ?? "";
const MAX_BODY_BYTES = 1_100_000;

const oversizedBody = () => json({ error: "Request body exceeds the 1.1 MB limit." }, 413);

async function readJsonBody(req: Request): Promise<Record<string, unknown> | Response> {
  if (!req.body) return json({ error: "Invalid JSON body." }, 400);
  const reader = req.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        void reader.cancel().catch(() => {});
        return oversizedBody();
      }
      text += decoder.decode(value, { stream: true });
    }
    const value: unknown = JSON.parse(text + decoder.decode());
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch {
    // Malformed JSON, invalid UTF-8 or an unreadable stream is a client error.
  } finally {
    reader.releaseLock();
  }
  return json({ error: "Invalid JSON body." }, 400);
}

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

  if (!["GET", "POST"].includes(req.method)) {
    return json({ error: "Method not allowed." }, 405);
  }
  const declaredLength = Number(req.headers.get("content-length") ?? 0);
  if (req.method === "POST" && declaredLength > MAX_BODY_BYTES) return oversizedBody();

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
    if (!organizationId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(organizationId)) return json({ error: "A valid organization_id is required." }, 400);
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
    const body = await readJsonBody(req);
    if (body instanceof Response) return body;
    const organizationId = typeof body.organization_id === "string" ? body.organization_id : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const goal = typeof body.goal === "string" ? body.goal.trim() : "";
    const channel = body.channel;
    const timezone = typeof body.timezone === "string" ? body.timezone : "Asia/Kolkata";
    let timezoneValid = false;
    try { new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date()); timezoneValid = true; } catch { /* invalid IANA timezone */ }
    if (!organizationId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(organizationId) ||
        !name || !goal || name.length > 120 || goal.length > 1000 || timezone.length > 80 || !timezoneValid ||
        !["voice", "whatsapp", "manual"].includes(String(channel))) {
      return json({ error: "Valid organization_id, name, goal, IANA timezone and channel are required." }, 400);
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


  // Paginated campaign contact workspace. This route is read-only and never dispatches outreach.
  if (req.method === "GET" && segments.length >= 3 &&
      segments[segments.length - 1] === "contacts" &&
      segments[segments.length - 3] === "campaigns") {
    const campaignId = segments[segments.length - 2];
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(campaignId)) {
      return json({ error: "Invalid campaign id." }, 400);
    }
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns").select("id, organization_id, channel")
      .eq("id", campaignId).single();
    if (campaignError || !campaign) return json({ error: "Campaign not found or access denied." }, 404);

    const limitRaw = Number(url.searchParams.get("limit") ?? 50);
    const offsetRaw = Number(url.searchParams.get("offset") ?? 0);
    if (!Number.isInteger(limitRaw) || limitRaw < 1 || limitRaw > 100 ||
        !Number.isInteger(offsetRaw) || offsetRaw < 0 || offsetRaw > 100000) {
      return json({ error: "limit must be 1-100 and offset must be 0-100000." }, 400);
    }
    const { data: enrolled, error: enrolledError, count } = await supabase
      .from("campaign_contacts")
      .select("id, contact_id, status, attempts, next_attempt_at, last_outcome, created_at", { count: "exact" })
      .eq("organization_id", campaign.organization_id)
      .eq("campaign_id", campaign.id)
      .order("created_at", { ascending: false })
      .range(offsetRaw, offsetRaw + limitRaw - 1);
    if (enrolledError) return json({ error: "Could not load campaign contacts; check RLS policies." }, 403);

    const ids = (enrolled ?? []).map((row: any) => row.contact_id);
    const [contactResult, permissionResult] = ids.length ? await Promise.all([
      supabase.from("contacts").select("id, full_name, phone_e164, email")
        .eq("organization_id", campaign.organization_id).in("id", ids),
      supabase.from("contact_channel_permissions")
        .select("contact_id, permission_status, evidence_reference")
        .eq("organization_id", campaign.organization_id)
        .eq("channel", campaign.channel).in("contact_id", ids),
    ]) : [
      { data: [], error: null },
      { data: [], error: null },
    ];
    if (contactResult.error || permissionResult.error) {
      return json({ error: "Could not load contact permission details; request failed closed." }, 403);
    }
    const contactById = new Map((contactResult.data ?? []).map((c: any) => [c.id, c]));
    const permissionById = new Map((permissionResult.data ?? []).map((p: any) => [p.contact_id, p]));
    const phones = (contactResult.data ?? []).map((c: any) => c.phone_e164).filter((phone: any) => typeof phone === "string");
    const suppressionQueries = [];
    if (ids.length) suppressionQueries.push(supabase.from("suppression_list").select("contact_id, phone_e164, channel")
      .eq("organization_id", campaign.organization_id).in("contact_id", ids));
    if (phones.length) suppressionQueries.push(supabase.from("suppression_list").select("contact_id, phone_e164, channel")
      .eq("organization_id", campaign.organization_id).in("phone_e164", phones));
    const suppressionResults = await Promise.all(suppressionQueries);
    if (suppressionResults.some((result: any) => result.error)) {
      return json({ error: "Could not load suppression details; preview failed closed." }, 403);
    }
    const suppressionRows = suppressionResults.flatMap((result: any) => result.data ?? []);
    const contacts = (enrolled ?? []).map((row: any) => {
      const contact: any = contactById.get(row.contact_id);
      const permission: any = permissionById.get(row.contact_id);
      const suppressed = suppressionRows.some((item: any) =>
        (!item.channel || item.channel === campaign.channel) &&
        ((item.contact_id && item.contact_id === row.contact_id) ||
         (item.phone_e164 && item.phone_e164 === contact?.phone_e164)));
      return {
        ...row,
        contact: contact ?? null,
        permission_status: permission?.permission_status ?? "missing",
        permission_evidence_present: Boolean(String(permission?.evidence_reference ?? "").trim()),
        suppressed,
      };
    });
    return json({ campaign: { id: campaign.id, channel: campaign.channel },
      contacts, pagination: { limit: limitRaw, offset: offsetRaw, total: count ?? 0 } });
  }

  // Read-only eligibility preview. This route never queues or dispatches outreach.
  if (req.method === "POST" && segments.length >= 3 &&
      segments[segments.length - 1] === "preview" &&
      segments[segments.length - 3] === "campaigns") {
    const campaignId = segments[segments.length - 2];
    if (!campaignId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(campaignId)) {
      return json({ error: "Invalid campaign id." }, 400);
    }
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id, organization_id, channel, status, dry_run, max_attempts")
      .eq("id", campaignId)
      .single();
    if (campaignError || !campaign) return json({ error: "Campaign not found or access denied." }, 404);
    if (!["voice", "whatsapp"].includes(campaign.channel)) {
      return json({ error: "Preview currently supports voice or WhatsApp campaigns only." }, 400);
    }

    // Bound the preview size. Large campaigns must be previewed in a future paginated job.
    const { data: enrolled, error: enrolledError } = await supabase
      .from("campaign_contacts")
      .select("id, contact_id, status, attempts")
      .eq("organization_id", campaign.organization_id)
      .eq("campaign_id", campaign.id)
      .order("created_at", { ascending: true })
      .range(0, 4999);
    if (enrolledError) return json({ error: "Could not load campaign contacts; check RLS policies." }, 403);
    if ((enrolled ?? []).length >= 5000) {
      return json({ error: "This preview is limited to 4,999 contacts. Use a paginated preview for larger campaigns." }, 413);
    }

    const contactIds = (enrolled ?? []).map((row: any) => row.contact_id);
    const { data: previewContacts, error: previewContactsError } = contactIds.length
      ? await supabase.from("contacts")
          .select("id, phone_e164")
          .eq("organization_id", campaign.organization_id)
          .in("id", contactIds)
      : { data: [], error: null };
    if (previewContactsError) return json({ error: "Could not load contact details; preview failed closed." }, 403);
    const previewContactById = new Map((previewContacts ?? []).map((contact: any) => [contact.id, contact]));

    const { data: permissions, error: permissionError } = contactIds.length
      ? await supabase.from("contact_channel_permissions")
          .select("contact_id, permission_status, evidence_reference")
          .eq("organization_id", campaign.organization_id)
          .eq("channel", campaign.channel)
          .in("contact_id", contactIds)
      : { data: [], error: null };
    if (permissionError) return json({ error: "Could not verify channel permissions; preview failed closed." }, 403);

    const { data: suppressions, error: suppressionError } = await supabase
      .from("suppression_list")
      .select("contact_id, phone_e164, channel")
      .eq("organization_id", campaign.organization_id);
    if (suppressionError) return json({ error: "Could not verify suppression list; preview failed closed." }, 403);

    const permissionByContact = new Map((permissions ?? []).map((p: any) => [p.contact_id, p]));
    const blockedByContact = new Map<string, string>();
    const suppressionRows = suppressions ?? [];
    const maxAttempts = Number(campaign.max_attempts ?? 3);
    const terminalStatuses = new Set(["in_progress", "reached", "qualified", "do_not_contact", "failed", "skipped"]);
    const counts = {
      total: (enrolled ?? []).length,
      eligible: 0,
      blocked: 0,
      permission_unknown: 0,
      permission_withdrawn: 0,
      missing_permission_or_evidence: 0,
      suppressed: 0,
      invalid_contact: 0,
      already_processed: 0,
      max_attempts_reached: 0,
    };
    const examples: Array<{ campaign_contact_id: string; reason: string }> = [];

    for (const row of enrolled ?? []) {
      const contact: any = previewContactById.get(row.contact_id);
      const phone = contact?.phone_e164 ?? "";
      let reason = "";
      if (!contact?.id || !/^\+[1-9]\d{7,14}$/.test(phone)) {
        counts.invalid_contact++;
        reason = "invalid_contact";
      } else {
        const permission: any = permissionByContact.get(row.contact_id);
        if (!permission) {
          counts.missing_permission_or_evidence++;
          reason = "missing_permission";
        } else if (permission.permission_status === "withdrawn") {
          counts.permission_withdrawn++;
          reason = "permission_withdrawn";
        } else if (permission.permission_status !== "granted") {
          counts.permission_unknown++;
          reason = "permission_not_granted";
        } else if (!String(permission.evidence_reference ?? "").trim()) {
          counts.missing_permission_or_evidence++;
          reason = "permission_evidence_missing";
        } else if (suppressionRows.some((item: any) =>
          (!item.channel || item.channel === campaign.channel) &&
          ((item.contact_id && item.contact_id === row.contact_id) ||
           (item.phone_e164 && item.phone_e164 === phone)))) {
          counts.suppressed++;
          reason = "suppressed";
        } else if (terminalStatuses.has(row.status)) {
          counts.already_processed++;
          reason = "already_processed";
        } else if (Number(row.attempts ?? 0) >= maxAttempts) {
          counts.max_attempts_reached++;
          reason = "max_attempts_reached";
        }
      }
      if (reason) {
        counts.blocked++;
        if (examples.length < 100) examples.push({ campaign_contact_id: row.id, reason });
      } else {
        counts.eligible++;
      }
    }

    return json({
      campaign: { id: campaign.id, channel: campaign.channel, status: campaign.status, dry_run: campaign.dry_run },
      campaign_state_allows_dispatch: campaign.status === "running" && campaign.dry_run === false,
      campaign_dispatch_ready: false,
      counts,
      blocked_examples: examples,
      truncated_examples: counts.blocked > examples.length,
      dispatch_enabled: false,
      note: "Read-only preview only. Eligible counts describe contact-level checks; campaign_dispatch_ready is always false in this release because no provider dispatch worker exists; campaign_state_allows_dispatch only reports the database campaign state. This endpoint never sends calls or messages.",
    });
  }

  // Contact opt-out: immediately suppress this channel and record a self-attributed audit event.
  if (req.method === "POST" && segments.length >= 3 &&
      segments[segments.length - 1] === "opt-out" &&
      segments[segments.length - 3] === "contacts") {
    const contactId = segments[segments.length - 2];
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(contactId)) {
      return json({ error: "Invalid contact id." }, 400);
    }
    const body = await readJsonBody(req);
    if (body instanceof Response) return body;
    const channel = typeof body.channel === "string" ? body.channel : "";
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : "contact_request";
    if (!["voice", "whatsapp", "email"].includes(channel)) {
      return json({ error: "channel must be voice, whatsapp or email." }, 400);
    }
    const { data: contact, error: contactError } = await supabase.from("contacts")
      .select("id, organization_id, phone_e164")
      .eq("id", contactId).single();
    if (contactError || !contact) return json({ error: "Contact not found or access denied." }, 404);

    const now = new Date().toISOString();
    const { error: suppressionError } = await supabase.from("suppression_list").insert({
      organization_id: contact.organization_id,
      contact_id: contact.id,
      phone_e164: contact.phone_e164,
      channel,
      reason: reason || "contact_request",
      source: "campaign_manager_opt_out",
    });
    if (suppressionError) return json({ error: "Could not save suppression. No success was recorded; retry or contact the workspace administrator." }, 403);

    const { error: permissionError } = await supabase.from("contact_channel_permissions").upsert({
      organization_id: contact.organization_id,
      contact_id: contact.id,
      channel,
      permission_status: "withdrawn",
      evidence_reference: null,
      captured_at: now,
      captured_by: authData.user.id,
    }, { onConflict: "contact_id,channel" });
    if (permissionError) {
      return json({ error: "Suppression was saved, but permission status update failed. The suppression record still blocks outreach; ask an administrator to reconcile this contact." }, 207);
    }

    const { error: auditError } = await supabase.from("audit_events").insert({
      organization_id: contact.organization_id,
      actor_user_id: authData.user.id,
      event_type: "contact_permission_withdrawn",
      entity_type: "contact",
      entity_id: contact.id,
      details: { channel, source: "campaign_manager_opt_out" },
    });
    return json({
      success: true,
      suppressed: true,
      permission_status: "withdrawn",
      audit_recorded: !auditError,
      note: auditError ? "Opt-out suppression is saved. Audit event could not be recorded; administrator review is required." : "This contact is suppressed for the selected channel. No further campaign messages or calls should be sent on this channel.",
    }, auditError ? 207 : 200);
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

    const body = await readJsonBody(req);
    if (body instanceof Response) return body;
    const csv = typeof body.csv_text === "string" ? body.csv_text : "";
    if (!csv || new TextEncoder().encode(csv).byteLength > 1_000_000) return json({ error: "CSV is required and must be at most 1 MB in UTF-8." }, 413);

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
    if (new Set(headers).size !== headers.length) return json({ error: "CSV headers must be unique." }, 400);
    if (!required.every((h) => headers.includes(h))) {
      return json({ error: "Required CSV headers: full_name, phone_e164, email, consent_status, consent_evidence." }, 400);
    }
    const index = Object.fromEntries(headers.map((h, i) => [h, i]));
    const result = { imported: 0, consent_granted: 0, rejected: 0, rows: [] as Array<Record<string, unknown>> };
    const seen = new Set<string>();

    for (let i = 1; i < rows.length; i++) {
      const values = rows[i];
      const get = (key: string) => (values[index[key]] ?? "").trim();
      const fullName = get("full_name");
      const phone = get("phone_e164");
      const email = get("email");
      const consentStatus = get("consent_status").toLowerCase();
      const consentEvidence = get("consent_evidence");
      const rowNumber = i + 1;

      if (values.length > headers.length || fullName.length > 160 || email.length > 254 || consentEvidence.length > 500 ||
          !["granted", "unknown", "withdrawn"].includes(consentStatus)) {
        result.rejected++;
        result.rows.push({ row: rowNumber, status: "rejected", reason: "Invalid column count, field length or consent_status. Use granted, unknown or withdrawn." });
        continue;
      }
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
      if (consentStatus === "granted" && !consentEvidence.trim()) {
        result.rejected++;
        result.rows.push({ row: rowNumber, status: "rejected", reason: "Granted permission requires a non-empty evidence reference." });
        continue;
      }
      const granted = consentStatus === "granted";
      const permissionStatus = consentStatus === "withdrawn" ? "withdrawn" : (granted ? "granted" : "unknown");

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

      const { data: priorPermission, error: priorPermissionError } = await supabase.from("contact_channel_permissions")
        .select("permission_status, evidence_reference, captured_at, captured_by")
        .eq("organization_id", campaign.organization_id)
        .eq("contact_id", contactId)
        .eq("channel", campaign.channel)
        .maybeSingle();
      if (priorPermissionError) {
        result.rejected++;
        result.rows.push({ row: rowNumber, status: "rejected", reason: "Existing permission state could not be verified; import failed closed." });
        continue;
      }
      if (priorPermission?.permission_status === "withdrawn" && permissionStatus !== "withdrawn") {
        result.rejected++;
        result.rows.push({ row: rowNumber, status: "rejected", reason: "This contact previously withdrew permission. A CSV import cannot reinstate it." });
        continue;
      }
      const preservePriorGrant = priorPermission?.permission_status === "granted" && permissionStatus === "unknown";
      const effectiveStatus = preservePriorGrant ? "granted" : permissionStatus;
      const effectiveEvidence = preservePriorGrant ? priorPermission.evidence_reference : (granted ? consentEvidence : null);
      const { error: permissionError } = await supabase.from("contact_channel_permissions").upsert({
        organization_id: campaign.organization_id,
        contact_id: contactId,
        channel: campaign.channel,
        permission_status: effectiveStatus,
        evidence_reference: effectiveEvidence,
        captured_at: preservePriorGrant ? priorPermission.captured_at : new Date().toISOString(),
        captured_by: preservePriorGrant ? priorPermission.captured_by : authData.user.id,
      }, { onConflict: "contact_id,channel" });
      if (permissionError) {
        result.rejected++;
        result.rows.push({ row: rowNumber, status: "rejected", reason: "Contact saved, but channel permission record failed. Review this contact before use." });
        continue;
      }

      if (effectiveStatus === "withdrawn") {
        const { error: suppressionError } = await supabase.from("suppression_list").insert({
          organization_id: campaign.organization_id,
          contact_id: contactId,
          phone_e164: phone,
          channel: campaign.channel,
          reason: "permission_withdrawn",
          source: "csv_import",
        });
        if (suppressionError) {
          result.rejected++;
          result.rows.push({ row: rowNumber, status: "rejected", reason: "Withdrawal recorded, but suppression record failed. Manually verify before any future use." });
          continue;
        }
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
      if (effectiveStatus === "granted") result.consent_granted++;
      result.rows.push({ row: rowNumber, status: "imported", permission: effectiveStatus });
    }
    return json({ ...result, note: "Import only stores contacts and permission evidence. It does not send calls or messages; unknown permission is not consent." }, 200);
  }

  return json({ error: "Route not found." }, 404);
});
