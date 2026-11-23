// GitHub Actions-only authenticated HTTP test for disposable PostgREST 14.
// All JWTs are signed with an ephemeral CI-only secret, NOT a Supabase key.
// Uses only synthetic database fixtures. Never sends messages.
import { createHmac } from "node:crypto";
import assert from "node:assert/strict";

const root = process.env.CRM_CI_REST_ORIGIN || "http://127.0.0.1:3000";
const secret = process.env.PGRST_JWT_SECRET;
assert.ok(secret && secret.length >= 32, "Missing disposable local JWT secret");

const USER_A = "00000000-0000-0000-0000-000000000001";
const USER_B = "00000000-0000-0000-0000-000000000002";
const ORG_A = "51000000-0000-4000-8000-000000000001";
const ORG_B = "51000000-0000-4000-8000-000000000002";
const CONTACT_A = "52000000-0000-4000-8000-000000000001";
const CONTACT_B = "52000000-0000-4000-8000-000000000003";
const CAMPAIGN_A = "53000000-0000-4000-8000-000000000001";

function tokenFor(sub) {
  const encoded = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const first = encoded({ alg: "HS256", typ: "JWT" });
  const second = encoded({
    role: "authenticated", aud: "authenticated",
    sub, iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 1800,
  });
  const sig = createHmac("sha256", secret).update(first + "." + second).digest("base64url");
  return first + "." + second + "." + sig;
}
const alpha = tokenFor(USER_A);
const beta = tokenFor(USER_B);
let passed = 0;

async function api(jwt, method, path, data, prefer = "return=representation") {
  const headers = {
    Accept: "application/json",
    ...(jwt ? { Authorization: "Bearer " + jwt } : {}),
    ...(data !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(method !== "GET" ? { Prefer: prefer } : {}),
  };
  const response = await fetch(root + path, {
    method, headers, body: data === undefined ? undefined : JSON.stringify(data),
    signal: AbortSignal.timeout(15000),
  });
  const raw = await response.text();
  let payload;
  try { payload = JSON.parse(raw); } catch { payload = raw; }
  return { status: response.status, payload };
}

function okResponse(result, label) {
  assert.ok([200, 201].includes(result.status),
    label + ": expected successful response; got HTTP " + result.status +
    " " + JSON.stringify(result.payload).slice(0, 350));
  return result.payload;
}
function blocked(result, label) {
  assert.ok([400,401,403,409,422].includes(result.status),
    label + ": security gate failed, unexpected HTTP " + result.status +
    " " + JSON.stringify(result.payload).slice(0, 350));
  passed++;
}
function checks(label, callback) {
  callback();
  passed++;
}

async function main() {
  // This test asserts real HTTP JWT role selection + RLS. It does not test
  // real Supabase Auth signup, sessions or an actual deployed Edge Function.
  blocked(await api(null, "GET", "/contacts?select=id"), "anon cannot read contacts");

  const organizationsA = okResponse(await api(alpha, "GET", "/organizations?select=id"), "Alpha organizations");
  const organizationsB = okResponse(await api(beta, "GET", "/organizations?select=id"), "Beta organizations");
  checks("organization isolation", () => {
    assert.deepEqual(organizationsA.map((x) => x.id), [ORG_A]);
    assert.deepEqual(organizationsB.map((x) => x.id), [ORG_B]);
  });

  const contactsA = okResponse(await api(alpha, "GET", "/contacts?select=id&order=id.asc"), "Alpha contacts");
  const contactsB = okResponse(await api(beta, "GET", "/contacts?select=id"), "Beta contacts");
  checks("contact tenant isolation", () => {
    assert.equal(contactsA.length, 2);
    assert.equal(contactsB.length, 1);
    assert.equal(contactsB[0].id, CONTACT_B);
    assert.ok(contactsA.some((x) => x.id === CONTACT_A));
    assert.ok(!contactsA.some((x) => x.id === CONTACT_B));
  });

  const foreignCampaigns = okResponse(await api(beta, "GET", "/campaigns?select=id"), "Beta campaign list");
  checks("foreign campaign hidden", () => assert.deepEqual(foreignCampaigns, []));

  blocked(await api(beta, "POST", "/contacts", {
    organization_id: ORG_B, full_name: "Forbidden viewer creation",
    phone_e164: "+919999000599",
  }), "viewer cannot add contacts");
  blocked(await api(alpha, "POST", "/contacts", {
    organization_id: ORG_B, full_name: "Forbidden cross-org insert",
    phone_e164: "+919999000598",
  }), "operator cannot insert cross-tenant contact");

  const ownCampaign = okResponse(await api(alpha, "POST", "/campaigns", {
    organization_id: ORG_A, name: "Synthetic REST draft new", goal: "No outreach",
    channel: "whatsapp", status: "draft", dry_run: true,
  }), "operator creates draft campaign");
  checks("new campaign stays draft dry-run", () => {
    assert.equal(ownCampaign.length, 1);
    assert.equal(ownCampaign[0].status, "draft");
    assert.equal(ownCampaign[0].dry_run, true);
  });

  blocked(await api(alpha, "POST", "/campaigns", {
    organization_id: ORG_A, name: "Forged live campaign", goal: "Not permitted",
    channel: "whatsapp", status: "running", dry_run: false,
  }), "direct live campaign creation denied");

  const enrollment = okResponse(await api(alpha, "POST", "/campaign_contacts", {
    organization_id: ORG_A, campaign_id: CAMPAIGN_A,
    contact_id: CONTACT_A, status: "queued", attempts: 0,
  }), "draft contact enrollment");
  assert.equal(enrollment.length,1);
  const enrollmentId = enrollment[0].id;
  passed++;

  blocked(await api(alpha, "POST", "/campaign_contacts", {
    organization_id: ORG_A, campaign_id: CAMPAIGN_A,
    contact_id: "52000000-0000-4000-8000-000000000002",
    status: "reached", attempts: 0,
  }), "operator cannot forge contact success");

  const patched = await api(alpha, "PATCH", "/campaign_contacts?id=eq." + enrollmentId, {
    status: "reached", attempts: 99,
  });
  assert.ok([200,204].includes(patched.status), "Unexpected PATCH status " + patched.status);
  const afterPatch = okResponse(await api(alpha, "GET",
    "/campaign_contacts?id=eq." + enrollmentId + "&select=id,status,attempts"), "read enrollment");
  checks("direct client status update has no effect", () => {
    assert.equal(afterPatch.length,1);
    assert.equal(afterPatch[0].status, "queued");
    assert.equal(afterPatch[0].attempts,0);
  });

  const deleted = await api(alpha, "DELETE", "/campaign_contacts?id=eq." + enrollmentId);
  assert.ok([200,204].includes(deleted.status), "Unexpected DELETE status " + deleted.status);
  const afterDelete = okResponse(await api(alpha, "GET",
    "/campaign_contacts?id=eq." + enrollmentId + "&select=id"), "enrollment still exists");
  checks("client cannot erase campaign enrollment", () => assert.equal(afterDelete.length, 1));

  blocked(await api(alpha, "PATCH", "/contacts?id=eq." + CONTACT_A, {
    phone_e164: "+919999000999",
  }), "consent-associated phone cannot be reassigned");

  blocked(await api(alpha, "PATCH", "/contact_channel_permissions?contact_id=eq." + CONTACT_A, {
    permission_status: "granted", evidence_reference: null, captured_at: null, captured_by: null,
  }), "grant without evidence blocked");

  const validPermission = await api(alpha, "PATCH",
    "/contact_channel_permissions?contact_id=eq." + CONTACT_A, {
      permission_status: "granted", evidence_reference: "synthetic-integration-only",
      captured_at: new Date(Date.now()-86400000).toISOString(), captured_by: USER_A,
    });
  okResponse(validPermission, "documented synthetic permission");

  const withdraw = await api(alpha,"PATCH",
    "/contact_channel_permissions?contact_id=eq." + CONTACT_A,
    {permission_status:"withdrawn"});
  okResponse(withdraw, "withdraw grant");
  blocked(await api(alpha, "PATCH",
    "/contact_channel_permissions?contact_id=eq." + CONTACT_A,
    {permission_status:"granted"}), "opt-out reversal denied");

  const suppressPath = "/suppression_list?on_conflict=contact_id%2Cchannel";
  const suppress = {
    organization_id: ORG_A, contact_id: CONTACT_A,
    phone_e164: "+919999000501", channel: "whatsapp",
    reason: "first_synthetic_optout", source: "campaign_manager_opt_out",
  };
  okResponse(await api(alpha,"POST",suppressPath,suppress,
    "resolution=ignore-duplicates,return=representation"), "first suppression");
  okResponse(await api(alpha,"POST",suppressPath,
    {...suppress,reason:"duplicate_request"}, "resolution=ignore-duplicates,return=representation"),
    "idempotent suppression");
  const currentSuppress = okResponse(await api(alpha,"GET",
    "/suppression_list?contact_id=eq."+CONTACT_A+"&channel=eq.whatsapp&select=id,reason"),"read suppression");
  checks("suppression idempotency preserves earliest reason",()=>{
    assert.equal(currentSuppress.length,1);
    assert.equal(currentSuppress[0].reason,"first_synthetic_optout");
  });

  blocked(await api(alpha, "POST", suppressPath, {
    organization_id: ORG_B, contact_id: CONTACT_B, phone_e164:"+919999000503",
    channel:"whatsapp", reason:"cross_tenant",source:"campaign_manager_opt_out",
  }, "resolution=ignore-duplicates,return=representation"),
    "foreign-tenant suppression denied");

  okResponse(await api(beta,"POST",suppressPath,{
    organization_id:ORG_B,contact_id:CONTACT_B,phone_e164:"+919999000503",
    channel:"voice",reason:"viewer_optout",source:"campaign_manager_opt_out",
  },"resolution=ignore-duplicates,return=representation"),"viewer can opt out");
  blocked(await api(beta,"POST","/contact_channel_permissions",{
    organization_id:ORG_B,contact_id:CONTACT_B,channel:"whatsapp",
    permission_status:"granted",evidence_reference:"fake",captured_at:new Date().toISOString(),
    captured_by:USER_B,
  }),"viewer cannot grant outbound consent");

  // The opt-out audit append must describe a real withdrawal backed by
  // durable channel suppression. Authenticated operators have INSERT rights
  // but deliberately lack SELECT rights on audit_events: avoid RETURNING.
  const validAudit = {
    organization_id: ORG_A, actor_user_id: USER_A,
    event_type: "contact_permission_withdrawn", entity_type: "contact",
    entity_id: CONTACT_A, details: { channel: "whatsapp", source: "campaign_manager_opt_out" },
  };
  const recorded = await api(alpha, "POST", "/audit_events", validAudit, "return=minimal");
  checks("real opt-out audit append succeeds without exposing the audit table", () => {
    assert.equal(recorded.status, 201,
      "Authenticated insert-only audit failed: " + JSON.stringify(recorded.payload).slice(0,200));
  });
  blocked(await api(alpha,"POST","/audit_events",{
    ...validAudit, entity_type: "campaign",
  },"return=minimal"),"cannot forge a campaign event as a contact withdrawal");
  blocked(await api(alpha,"POST","/audit_events",{
    ...validAudit, actor_user_id: USER_B,
  },"return=minimal"),"cannot attribute audit to someone else");
  blocked(await api(alpha,"POST","/audit_events",{
    ...validAudit, details: { channel: "voice", source: "campaign_manager_opt_out" },
  },"return=minimal"),"cannot claim a withdrawal on an unsuppressed channel");
  blocked(await api(alpha,"POST","/audit_events",{
    ...validAudit, entity_id: CONTACT_B,
  },"return=minimal"),"cannot audit a foreign tenant contact");
  blocked(await api(alpha,"POST","/audit_events",{
    ...validAudit, details: {
      channel:"whatsapp",source:"campaign_manager_opt_out",extra:"unsanctioned"
    },
  },"return=minimal"),"cannot append unapproved audit payload");
  blocked(await api(beta,"POST","/audit_events",{
    organization_id:ORG_B, actor_user_id:USER_B,
    event_type:"contact_permission_withdrawn",entity_type:"contact",
    entity_id:CONTACT_B, details:{channel:"voice",source:"campaign_manager_opt_out"},
  },"return=minimal"),"suppression alone cannot fabricate missing withdrawn permission");

  const finalPermissions=okResponse(await api(alpha, "GET",
    "/contact_channel_permissions?contact_id=eq."+CONTACT_A+"&select=permission_status"),"final permissions");
  checks("withdrawn permission persists",()=>{
    assert.equal(finalPermissions.length,1);
    assert.equal(finalPermissions[0].permission_status,"withdrawn");
  });

  const atomicOptout = okResponse(await api(alpha, "POST",
    "/rpc/record_campaign_contact_opt_out", {
      p_contact_id: "52000000-0000-4000-8000-000000000002",
      p_channel: "whatsapp",
      p_reason: "synthetic_atomic_withdrawal",
    }), "atomic authenticated opt-out RPC");
  checks("opt-out RPC commits suppression, permission, and audit together",()=>{
    assert.equal(atomicOptout.success,true);
    assert.equal(atomicOptout.suppressed,true);
    assert.equal(atomicOptout.permission_status,"withdrawn");
    assert.equal(atomicOptout.audit_recorded,true);
  });
  const afterAtomicSuppression = okResponse(await api(alpha, "GET",
    "/suppression_list?contact_id=eq.52000000-0000-4000-8000-000000000002&select=channel,reason"),
    "suppression after atomic RPC");
  const afterAtomicPermission = okResponse(await api(alpha, "GET",
    "/contact_channel_permissions?contact_id=eq.52000000-0000-4000-8000-000000000002&select=channel,permission_status"),
    "permission after atomic RPC");
  checks("new opt-out RPC wrote both durable records",()=>{
    assert.equal(afterAtomicSuppression.length,1);
    assert.equal(afterAtomicSuppression[0].reason,"synthetic_atomic_withdrawal");
    assert.equal(afterAtomicPermission.length,1);
    assert.equal(afterAtomicPermission[0].permission_status,"withdrawn");
  });
  const repeatedAtomic = okResponse(await api(alpha, "POST",
    "/rpc/record_campaign_contact_opt_out", {
      p_contact_id: "52000000-0000-4000-8000-000000000002",
      p_channel: "whatsapp",
      p_reason: "repeat_synthetic_request",
    }), "idempotent authenticated opt-out RPC");
  checks("repeat opt-out RPC reports success",()=>assert.equal(repeatedAtomic.audit_recorded,true));
  const afterRetry = okResponse(await api(alpha, "GET",
    "/suppression_list?contact_id=eq.52000000-0000-4000-8000-000000000002&select=reason"),
    "suppression after atomic retry");
  checks("retry does not rewrite original suppression",()=>{
    assert.equal(afterRetry.length,1);
    assert.equal(afterRetry[0].reason,"synthetic_atomic_withdrawal");
  });
  blocked(await api(beta,"POST","/rpc/record_campaign_contact_opt_out",{
    p_contact_id: "52000000-0000-4000-8000-000000000002",
    p_channel: "voice",
    p_reason: "foreign_tenant",
  }),"viewer cannot opt out a foreign tenant");
  blocked(await api(null,"POST","/rpc/record_campaign_contact_opt_out",{
    p_contact_id: "52000000-0000-4000-8000-000000000002",
    p_channel: "voice",
  }),"anon cannot invoke atomic opt-out");

  console.log("PASS: "+passed+" HTTP JWT/RLS assertions against disposable fictional PostgREST tenant database.");
  console.log("No customer data, real credentials, SMS, WhatsApp messages or calls used.");
}
main().catch((error)=>{
  console.error("FAIL:",error.message);
  process.exitCode=1;
});
