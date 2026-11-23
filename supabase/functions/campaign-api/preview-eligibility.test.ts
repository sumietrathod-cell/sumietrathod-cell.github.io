import { previewBlockReason } from "./preview-eligibility.ts";

// All test inputs are synthetic. This helper never accesses a backend or sends anything.
const now = new Date("2026-11-23T06:30:00.000Z"); // 12:00 in Asia/Kolkata
const baseCampaign = {
  max_attempts: 3, timezone: "Asia/Kolkata",
  calling_window_start: "09:00:00", calling_window_end: "18:00:00",
};
const baseEnrollment = { status: "queued", attempts: 0, next_attempt_at: null as string | null };
const basePermission = {
  permission_status: "granted",
  evidence_reference: "synthetic-consent-reference",
  captured_at: "2026-11-22T06:30:00.000Z",
  captured_by: "00000000-0000-4000-8000-000000000001",
};
type Overrides = {
  campaign?: Partial<typeof baseCampaign>;
  enrollment?: Partial<typeof baseEnrollment>;
  permission?: Partial<typeof basePermission> | null;
  phone?: string | null;
  suppressed?: boolean;
};
function evaluate(x: Overrides = {}) {
  return previewBlockReason(
    { ...baseCampaign, ...x.campaign },
    { ...baseEnrollment, ...x.enrollment },
    x.phone === undefined ? "+919999000123" : x.phone,
    x.permission === null ? null : { ...basePermission, ...x.permission },
    x.suppressed ?? false,
    now,
  );
}
const cases: Array<[string, Overrides, string | null]> = [
  ["documented and due first contact", {}, null],
  ["no permission", { permission: null }, "missing_permission"],
  ["withdrawn", { permission: { permission_status: "withdrawn" } }, "permission_withdrawn"],
  ["unknown", { permission: { permission_status: "unknown" } }, "permission_not_granted"],
  ["no consent evidence", { permission: { evidence_reference: "  " } }, "permission_evidence_missing"],
  ["missing captured-by actor", { permission: { captured_by: null as never } }, "permission_proof_incomplete"],
  ["missing captured date", { permission: { captured_at: null as never } }, "permission_proof_incomplete"],
  ["invalid captured date", { permission: { captured_at: "not-a-date" } }, "permission_proof_incomplete"],
  ["future captured date", { permission: { captured_at: "2026-11-24T00:00:00Z" } }, "permission_proof_incomplete"],
  ["suppressed", { suppressed: true }, "suppressed"],
  ["missing phone", { phone: null }, "invalid_contact"],
  ["bad E.164", { phone: "9999000123" }, "invalid_contact"],
  ["completed", { enrollment: { status: "reached" } }, "already_processed"],
  ["invalid state", { enrollment: { status: "unexpected" } }, "already_processed"],
  ["max attempt cap", { enrollment: { attempts: 3 } }, "max_attempts_reached"],
  ["negative attempt count", { enrollment: { attempts: -1 } }, "max_attempts_reached"],
  ["future callback", { enrollment: { status: "callback", next_attempt_at: "2026-11-23T06:31:00Z" } }, "retry_not_due"],
  ["missing callback due date", { enrollment: { status: "callback" } }, "retry_not_due"],
  ["due callback", { enrollment: { status: "callback", next_attempt_at: "2026-11-23T06:29:00Z" } }, null],
  ["missing no-answer due date", { enrollment: { status: "no_answer" } }, "retry_not_due"],
  ["due no-answer", { enrollment: { status: "no_answer", next_attempt_at: "2026-11-23T06:29:00Z" } }, null],
  ["future first-contact date", { enrollment: { next_attempt_at: "2026-11-24T06:30:00Z" } }, "retry_not_due"],
  ["missing window", { campaign: { calling_window_start: null as never } }, "calling_window_missing_or_invalid"],
  ["zero-length window", { campaign: { calling_window_end: "09:00:00" } }, "calling_window_missing_or_invalid"],
  ["overnight window", { campaign: { calling_window_start: "21:00:00", calling_window_end: "05:00:00" } }, "calling_window_missing_or_invalid"],
  ["invalid timezone", { campaign: { timezone: "Invalid/Not-A-Zone" } }, "calling_window_missing_or_invalid"],
  ["before configured window", { campaign: { calling_window_start: "13:00:00" } }, "outside_calling_window"],
  ["after configured window", { campaign: { calling_window_end: "11:30:00" } }, "outside_calling_window"],
  ["inclusive start", { campaign: { calling_window_start: "12:00:00" } }, null],
  ["exclusive end", { campaign: { calling_window_end: "12:00:00" } }, "outside_calling_window"],
];
for (const [name, changes, expected] of cases) {
  Deno.test("CRM preview: " + name, () => {
    const actual = evaluate(changes);
    if (actual !== expected) throw new Error(`Expected ${expected} but got ${actual}`);
  });
}
