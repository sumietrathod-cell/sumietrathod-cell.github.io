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

const claimSynthetic = readFileSync(new URL('../campaign-manager/supabase/tests/queue-claim-eligibility.sql', import.meta.url), 'utf8');

test('queue claim test mirrors exact source with synthetic table names', () => {
  const from = worker.indexOf('create or replace function public.claim_due_campaign_jobs(');
  const to = worker.indexOf('revoke all on function public.claim_due_campaign_jobs(', from);
  assert.ok(from >= 0 && to > from);
  const functionBody = worker.slice(from,to).trim();
  const translated = functionBody
    .replaceAll('public.claim_due_campaign_jobs','pg_temp.claim_due_campaign_jobs_test')
    .replaceAll('public.campaign_jobs','pg_temp.synthetic_jobs')
    .replaceAll('public.campaign_contacts','pg_temp.synthetic_campaign_contacts')
    .replaceAll('public.campaigns','pg_temp.synthetic_campaigns')
    .replaceAll('public.contacts','pg_temp.synthetic_contacts')
    .replaceAll('public.contact_channel_permissions','pg_temp.synthetic_permissions')
    .replaceAll('public.suppression_list','pg_temp.synthetic_suppressions');
  assert.ok(claimSynthetic.includes(translated),
    'Synthetic SQL test has drifted from staged queue claim function');
  assert.match(claimSynthetic,/CREATE TEMP TABLE synthetic_jobs/i);
  assert.match(claimSynthetic,/ROLLBACK;\s*$/i);
  assert.match(claimSynthetic,/11 temporary jobs, 1 eligible/i);
});

test('queue claim cannot bypass explicit local windows or consent metadata', () => {
  const start = worker.indexOf('create or replace function public.claim_due_campaign_jobs(');
  const end = worker.indexOf('revoke all on function public.claim_due_campaign_jobs(',start);
  const body = worker.slice(start,end);
  assert.match(body,/c\.calling_window_start is not null/i);
  assert.match(body,/c\.calling_window_end is not null/i);
  assert.match(body,/c\.calling_window_start < c\.calling_window_end/i);
  assert.doesNotMatch(body,/c\.calling_window_start is null and c\.calling_window_end is null/i);
  assert.match(body,/p\.captured_at is not null/i);
  assert.match(body,/p\.captured_at <= now\(\)/i);
  assert.match(body,/p\.captured_by is not null/i);
  assert.match(body,/nullif\(trim\(p\.evidence_reference\), ''\) is not null/i);
  assert.match(body,/and c\.dry_run = false/i);
  assert.match(body,/and c\.status = 'running'/i);
  assert.match(body,/and not exists\s*\([\s\S]*?from public\.suppression_list as s/i);
  assert.match(worker,/revoke all on function public\.claim_due_campaign_jobs\(integer, text\) from public, anon, authenticated;/i);
  assert.match(worker,/grant execute on function public\.claim_due_campaign_jobs\(integer, text\) to service_role;/i);
});
