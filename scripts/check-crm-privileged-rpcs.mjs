import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const baseline = readFileSync(new URL('../supabase/migrations/20261119004000_campaign_sales_followup_report.sql', import.meta.url), 'utf8');
const candidate = readFileSync(new URL('../supabase/release-candidates/admin-rpc-uid-guards-review.sql', import.meta.url), 'utf8');
const start = 'create function public.campaign_record_sale(';
const end = 'revoke all on function public.campaign_record_sale(';
const guard = "if (auth.jwt()->'app_metadata'->>'campaign_manager_role') is distinct from 'admin' then";
const a = baseline.indexOf(start), b = baseline.indexOf(end, a);
assert.ok(a >= 0 && b > a, 'Original function definitions missing');
const originalFunctions = baseline.slice(a,b).trim();
const patchedStart = 'create or replace function public.campaign_record_sale(';
const patchedEnd = '-- Preserve the existing limited execution grants.';
const x = candidate.indexOf(patchedStart), y = candidate.indexOf(patchedEnd, x);
assert.ok(x >= 0 && y > x, 'Review patch function definitions missing');
const candidateFunctions = candidate.slice(x,y).trim();

test('only the two Admin RPC guards and CREATE OR REPLACE changed', () => {
  assert.equal(originalFunctions.split(guard).length - 1, 2, 'Unexpected original Admin checks');
  const expected = originalFunctions
    .replaceAll('create function public.', 'create or replace function public.')
    .replaceAll(guard, "if auth.uid() is null or " + guard.slice(3));
  assert.equal(candidateFunctions, expected, 'The candidate must not alter existing sales or reporting logic');
});

test('both privileged Admin functions block missing user IDs', () => {
  const parts = candidateFunctions.split('create or replace function public.');
  assert.equal(parts.length, 3, 'Exactly two reviewed functions must be present');
  for (const functionSource of parts.slice(1)) {
    assert.match(functionSource, /if auth\.uid\(\) is null or \(auth\.jwt\(\)->'app_metadata'->>'campaign_manager_role'\) is distinct from 'admin' then/i);
    assert.match(functionSource, /security definer set search_path = ''/i);
  }
  assert.match(candidate, /revoke all on function public\.campaign_record_sale\(uuid,text,numeric\),public\.campaign_admin_report\(\) from public, anon/i);
  assert.doesNotMatch(candidate, /service_role\s*=/i);
});
