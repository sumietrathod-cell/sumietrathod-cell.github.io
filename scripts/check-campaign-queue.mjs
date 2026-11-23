import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const worker = readFileSync(new URL('../campaign-manager/supabase/queue-worker.sql', import.meta.url), 'utf8');
const synthetic = readFileSync(new URL('../campaign-manager/supabase/tests/queue-quarantine.sql', import.meta.url), 'utf8');

const first = 'create or replace function public.quarantine_stale_campaign_jobs(';
const last = 'revoke all on function public.quarantine_stale_campaign_jobs';
const start = worker.indexOf(first);
const end = worker.indexOf(last, start);
assert.ok(start >= 0 && end > start, 'Quarantine source function missing');
const body = worker.slice(start, end).trim();
const expected = body
  .replace('public.quarantine_stale_campaign_jobs(', 'pg_temp.quarantine_stale_campaign_jobs_test(')
  .replaceAll('public.campaign_jobs', 'pg_temp.synthetic_campaign_jobs');

test('SQL synthetic exercise uses the EXACT staged implementation', () => {
  assert.ok(synthetic.includes(expected), 'The synthetic SQL test no longer matches actual quarantine function');
  assert.match(synthetic, /\bROLLBACK;\s*$/i);
  assert.match(synthetic, /CREATE TEMP TABLE synthetic_campaign_jobs/i);
  assert.doesNotMatch(synthetic, /UPDATE\s+public\.campaign_jobs/i);
});

test('stale claims become terminal failed and never automatically requeued', () => {
  assert.match(body, /where\s+j\.status\s*=\s*'processing'/i);
  assert.match(body, /j\.locked_at\s+is not null/i);
  assert.match(body, /j\.locked_at\s*<=\s*now\(\)\s*-\s*make_interval/i);
  assert.match(body, /for update of j skip locked/i);
  assert.match(body, /set status = 'failed'/i);
  assert.match(body, /last_error_code = 'stale_claim_needs_manual_review'/i);
  assert.doesNotMatch(body, /set status\s*=\s*'queued'/i);
  assert.doesNotMatch(body, /set attempts\s*=/i);
  assert.doesNotMatch(body, /\bfetch\s*\(|https?:\/\//i);
});

test('quarantine worker cannot be invoked by signed-in users', () => {
  const expectedRevoke = /revoke all on function public\.quarantine_stale_campaign_jobs\(integer, integer\)\s+from public, anon, authenticated;/i;
  const expectedGrant = /grant execute on function public\.quarantine_stale_campaign_jobs\(integer, integer\)\s+to service_role;/i;
  assert.match(worker, expectedRevoke);
  assert.match(worker, expectedGrant);
  assert.match(body, /p_stale_after_minutes\s*<\s*15/i);
  assert.match(body, /p_stale_after_minutes\s*>\s*1440/i);
  assert.match(body, /p_batch_size\s*<\s*1/i);
  assert.match(body, /p_batch_size\s*>\s*100/i);
});
