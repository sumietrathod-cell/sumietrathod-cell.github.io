import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const html = readFileSync(new URL("../campaign-manager-dashboard.html", import.meta.url), "utf8");
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map((match) => match[1])
  .filter((script) => script.trim().length > 0);
assert.equal(scripts.length, 1, "Expected exactly one inline dashboard script");
new Function(scripts[0]);

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, "Dashboard DOM ids must be unique");
const referencedIds = [...scripts[0].matchAll(/\$\("([^"]+)"\)/g)].map((match) => match[1]);
for (const id of referencedIds) {
  assert.ok(ids.includes(id), \`Dashboard script references missing DOM id: \${id}\`);
}

for (const required of [
  "campaign-api",
  "/contacts/",
  "/opt-out",
  "/contacts/import",
  "/preview",
  "campaign_dispatch_ready",
  "dry_run",
]) {
  assert.ok(html.includes(required), \`Dashboard is missing expected integration marker: \${required}\`);
}

console.log("Campaign dashboard checks passed.");
