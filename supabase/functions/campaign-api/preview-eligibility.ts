// Pure, read-only CRM contact preflight. This is NOT send authorization.
// It mirrors the queue claim's consent, due-date, suppression and configured
// calling-window restrictions; a real sender must recheck these and applicable
// platform/jurisdiction rules immediately before dispatch.
type Campaign = {
  max_attempts: number | null;
  timezone: string | null;
  calling_window_start: string | null;
  calling_window_end: string | null;
};
type Enrollment = { status: string; attempts: number | null; next_attempt_at: string | null };
type Permission = {
  permission_status: string;
  evidence_reference: string | null;
  captured_at: string | null;
  captured_by: string | null;
} | null;

const terminalStatuses = new Set(["in_progress", "reached", "qualified", "do_not_contact", "failed", "skipped"]);

function secondsOfTime(value: string | null): number | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?$/.exec(value);
  if (!match) return null;
  const h = Number(match[1]), m = Number(match[2]), s = Number(match[3]);
  if (h > 23 || m > 59 || s > 59) return null;
  return h * 3600 + m * 60 + s;
}

function localSecondOfDay(now: Date, timezone: string | null): number | null {
  if (!timezone) return null;
  try {
    const pieces = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone, hourCycle: "h23", hour: "2-digit",
      minute: "2-digit", second: "2-digit",
    }).formatToParts(now);
    const parts = Object.fromEntries(pieces.map((part) => [part.type, part.value]));
    const h = Number(parts.hour), m = Number(parts.minute), s = Number(parts.second);
    return Number.isInteger(h) && h <= 23 && Number.isInteger(m) && m <= 59 &&
      Number.isInteger(s) && s <= 59 ? h * 3600 + m * 60 + s : null;
  } catch {
    return null;
  }
}

export function previewBlockReason(
  campaign: Campaign,
  enrollment: Enrollment,
  phone: string | null,
  permission: Permission,
  suppressed: boolean,
  now: Date,
): string | null {
  if (!phone || !/^\+[1-9]\d{7,14}$/.test(phone)) return "invalid_contact";
  if (!permission) return "missing_permission";
  if (permission.permission_status === "withdrawn") return "permission_withdrawn";
  if (permission.permission_status !== "granted") return "permission_not_granted";
  if (!String(permission.evidence_reference ?? "").trim()) return "permission_evidence_missing";
  const capturedAt = Date.parse(permission.captured_at ?? "");
  if (!permission.captured_by || !Number.isFinite(capturedAt) || capturedAt > now.getTime()) {
    return "permission_proof_incomplete";
  }
  if (suppressed) return "suppressed";
  if (terminalStatuses.has(enrollment.status) || !["queued", "callback", "no_answer"].includes(enrollment.status)) {
    return "already_processed";
  }
  const maxAttempts = Number(campaign.max_attempts);
  const attempts = Number(enrollment.attempts);
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 ||
      !Number.isInteger(attempts) || attempts < 0 || attempts >= maxAttempts) return "max_attempts_reached";
  const next = enrollment.next_attempt_at;
  if (enrollment.status !== "queued" && !next) return "retry_not_due";
  if (next) {
    const at = Date.parse(next);
    if (!Number.isFinite(at) || at > now.getTime()) return "retry_not_due";
  }
  const start = secondsOfTime(campaign.calling_window_start);
  const end = secondsOfTime(campaign.calling_window_end);
  const localNow = localSecondOfDay(now, campaign.timezone);
  if (start === null || end === null || start >= end || localNow === null) {
    return "calling_window_missing_or_invalid";
  }
  if (localNow < start || localNow >= end) return "outside_calling_window";
  return null;
}
