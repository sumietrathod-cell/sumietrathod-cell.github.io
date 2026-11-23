import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const sql = readFileSync(new URL('../campaign-manager/supabase/rls-policies.sql', import.meta.url), 'utf8');
test('operator policy grants are limited to insert/update, never ALL or DELETE', () => {
  assert.doesNotMatch(sql, /create policy permissions_operator_write\s+[\s\S]*?for all\s+to authenticated/i);
  assert.match(sql, /create policy permissions_operator_insert\s+[\s\S]*?for insert to authenticated/i);
  assert.match(sql, /create policy permissions_operator_update\s+[\s\S]*?for update to authenticated/i);
  assert.doesNotMatch(sql, /create policy permissions_operator_delete/i);
});
test('permission guard blocks withdrawn reversal, cross-tenant mutation and false grants', () => {
  assert.match(sql, /create or replace function public\.guard_contact_channel_permission\(\)/i);
  assert.match(sql, /old\.permission_status\s*=\s*'withdrawn'\s+and new\.permission_status\s*<>\s*'withdrawn'/i);
  assert.match(sql, /old\.organization_id, old\.contact_id, old\.channel/);
  assert.match(sql, /new\.organization_id, new\.contact_id, new\.channel/);
  for (const field of ['new.evidence_reference','new.captured_by','new.captured_at']) assert.ok(sql.includes(field));
  assert.match(sql, /before insert or update on public\.contact_channel_permissions/i);
});

test('staging preflight fails closed on existing tenant or legacy CRM tables', () => {
  const preflight = readFileSync(new URL('../campaign-manager/supabase/preflight.sql', import.meta.url), 'utf8');
  for (const table of ['organizations','organization_members','campaigns','contacts','contact_channel_permissions','campaign_contacts','suppression_list','outreach_attempts','audit_events','campaign_jobs']) {
    assert.ok(preflight.includes("'" + table + "'"), 'Missing collision check: ' + table);
  }
  assert.match(preflight, /raise exception 'STOP: target public tables already exist:/i);
  assert.match(preflight, /table_schema = 'public'/i);
});

test('campaign contacts cannot forge outcomes or attempts through client RLS', () => {
  assert.doesNotMatch(sql, /create policy campaign_contacts_operator_write\s+[\s\S]*?for all to authenticated/i);
  assert.match(sql,/create policy campaign_contacts_operator_insert\s+[\s\S]*?for insert to authenticated/i);
  const from = sql.indexOf('create policy campaign_contacts_operator_insert');
  const to = sql.indexOf('create policy suppression_member_select',from);
  assert.ok(from>=0&&to>from);
  const p = sql.slice(from,to);
  assert.match(p,/status\s*=\s*'queued'/i);
  assert.match(p,/attempts\s*=\s*0/i);
  assert.match(p,/next_attempt_at is null/i);
  assert.match(p,/last_outcome is null/i);
  assert.match(p,/c\.status\s*=\s*'draft'/i);
  assert.match(p,/c\.dry_run is true/i);
  assert.doesNotMatch(sql,/create policy campaign_contacts_operator_update/i);
  assert.doesNotMatch(sql,/create policy campaign_contacts_operator_delete/i);
});

test('contact identity cannot change after any permission or campaign enrollment', () => {
  const f = 'public.guard_campaign_contact_identity';
  assert.ok(sql.includes('create or replace function '+f+'()'));
  assert.match(sql,/old\.id is distinct from new\.id/i);
  assert.match(sql,/old\.organization_id is distinct from new\.organization_id/i);
  assert.match(sql,/old\.phone_e164 is distinct from new\.phone_e164/i);
  assert.match(sql,/select 1 from public\.contact_channel_permissions p/i);
  assert.match(sql,/select 1 from public\.campaign_contacts cc/i);
  assert.match(sql,/before update on public\.contacts/i);
  assert.match(sql,/revoke all on function public\.guard_campaign_contact_identity\(\) from public, anon, authenticated;/i);
  const tests = readFileSync(new URL('../campaign-manager/supabase/tests/tenant-contact-identity-ci.sql', import.meta.url), 'utf8');
  assert.match(tests,/real PostgreSQL blocks consent-phone reassignment/i);
  assert.match(tests,/ROLLBACK;\s*$/i);
});

test('fresh-install foreign keys preserve consent, enrollment and attempt history', () => {
  const schema = readFileSync(new URL('../campaign-manager/supabase/schema.sql', import.meta.url), 'utf8');
  for (const fk of [
    /contact_id uuid not null references public\.contacts\(id\) on delete restrict/i,
    /campaign_id uuid not null references public\.campaigns\(id\) on delete restrict/i,
    /campaign_contact_id uuid not null references public\.campaign_contacts\(id\) on delete restrict/i,
    /references public\.contacts\(organization_id, id\) on delete restrict/i,
    /references public\.campaigns\(organization_id, id\) on delete restrict/i,
    /references public\.campaign_contacts\(organization_id, id\) on delete restrict/i,
  ]) assert.match(schema, fk);
  const exercise = readFileSync(new URL('../campaign-manager/supabase/tests/tenant-history-retention-ci.sql', import.meta.url), 'utf8');
  assert.match(exercise, /foreign_key_violation/i);
  assert.match(exercise, /permission_status='withdrawn'/i);
  assert.match(exercise, /ROLLBACK;\s*$/i);
});

test('repeat opt-outs and CSV withdrawals are idempotent without overwriting earlier suppression', () => {
  const schema = readFileSync(new URL('../campaign-manager/supabase/schema.sql', import.meta.url), 'utf8');
  const api = readFileSync(new URL('../supabase/functions/campaign-api/index.ts', import.meta.url), 'utf8');
  assert.match(schema,/create unique index if not exists idx_suppression_contact_channel_unique\s+on public\.suppression_list \(contact_id, channel\)/i);
  const upsert = /from\("suppression_list"\)\.upsert\(\{[\s\S]*?\}, \{ onConflict: "contact_id,channel", ignoreDuplicates: true \}\);/g;
  const matches = [...api.matchAll(upsert)];
  assert.equal(matches.length,2,'Both opt-out and CSV withdrawal must preserve first suppression on retry');
  assert.doesNotMatch(api,/from\("suppression_list"\)\.insert\(\{/i);
  const ci = readFileSync(new URL('../campaign-manager/supabase/tests/tenant-suppression-idempotency-ci.sql', import.meta.url), 'utf8');
  assert.match(ci,/ON CONFLICT \(contact_id,channel\) DO NOTHING/i);
  assert.match(ci,/ROLLBACK;\s*$/i);
});

test('existing staging suppression migration fails closed on duplicates', () => {
  const migration = readFileSync(new URL('../campaign-manager/supabase/migrations/20261123_suppression_idempotency.sql', import.meta.url), 'utf8');
  assert.match(migration,/to_regclass\('public\.suppression_list'\)/i);
  assert.match(migration,/GROUP BY contact_id, channel\s+HAVING count\(\*\) > 1/i);
  assert.match(migration,/IF duplicate_groups > 0 THEN\s+RAISE EXCEPTION/i);
  assert.doesNotMatch(migration,/DELETE FROM public\.suppression_list/i);
  assert.match(migration,/CREATE UNIQUE INDEX IF NOT EXISTS idx_suppression_contact_channel_unique/i);
  assert.match(migration,/COMMIT;/i);
});

test('client opt-out audit log entries must reflect real same-tenant withdrawn consent', () => {
  const policy = sql.slice(sql.indexOf('create policy audit_actor_insert'));
  for(const clause of [
    /actor_user_id = \(select auth\.uid\(\)\)/i,
    /event_type = 'contact_permission_withdrawn'/i,
    /entity_type = 'contact'/i,
    /entity_id is not null/i,
    /details = jsonb_build_object/i,
    /select 1 from public\.contacts c/i,
    /select 1 from public\.contact_channel_permissions p/i,
    /p\.permission_status = 'withdrawn'/i,
    /select 1 from public\.suppression_list s/i,
    /s\.source = 'campaign_manager_opt_out'/i
  ]) assert.match(policy, clause);
  const ci = readFileSync(new URL('../campaign-manager/supabase/tests/tenant-audit-integrity-ci.sql', import.meta.url), 'utf8');
  assert.match(ci,/eight invalid opt-out audit claims rejected/i);
  assert.match(ci,/ROLLBACK;\s*$/i);
});
