import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const pages = [
  ["../campaign-manager-dashboard.html", "dashboard"],
  ["../campaign-manager-demo.html", "campaign simulation demo"],
  ["../campaign-contacts-demo.html", "contact workspace demo"],
];

let dashboardHtml = "";
for (const [path, label] of pages) {
  const html = read(path);
  if (label === "dashboard") dashboardHtml = html;
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .filter((script) => script.trim().length > 0);
  assert.ok(scripts.length > 0, "Expected inline JavaScript in " + label);
  for (const script of scripts) new Function(script);

  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, "DOM ids must be unique in " + label);
  if (label === "dashboard") {
    const referencedIds = [...scripts.join("\n").matchAll(/\$\("([^"]+)"\)/g)].map((match) => match[1]);
    for (const id of referencedIds) {
      assert.ok(ids.includes(id), "Dashboard script references missing DOM id: " + id);
    }
  }
}

const api = read("../supabase/functions/campaign-api/index.ts");
for (const required of [
  "campaign-api",
  "/contacts/",
  "/opt-out",
  "/contacts/import",
  "/preview",
  "campaign_state_allows_dispatch",
  "dry_run",
]) {
  assert.ok(dashboardHtml.includes(required), "Dashboard is missing expected integration marker: " + required);
}
assert.ok(api.includes("campaign_dispatch_ready: false"), "Backend must keep actual dispatch disabled.");
assert.ok(api.includes('import { previewBlockReason } from "./preview-eligibility.ts"'),
  "Read-only preview must use the tested eligibility gate.");
assert.ok(api.includes('.select("contact_id, permission_status, evidence_reference, captured_at, captured_by")'),
  "Preview must retrieve evidence actor/date, not status alone.");
assert.ok(api.includes('.select("id, contact_id, status, attempts, next_attempt_at")'),
  "Preview must retrieve callback due dates.");
assert.ok(api.includes("calling_window_start, calling_window_end"),
  "Preview must retrieve the configured campaign time window.");
assert.ok(api.includes("const reason = previewBlockReason("),
  "Preview route must actually invoke the tested fail-closed gate.");
assert.ok(api.includes("dispatch_enabled: false"),
  "Preview must never enable delivery.");


console.log("Campaign dashboard, demo pages and API static checks passed.");
