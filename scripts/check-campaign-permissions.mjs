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
