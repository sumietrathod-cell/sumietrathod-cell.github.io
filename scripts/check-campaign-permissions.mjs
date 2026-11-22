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
