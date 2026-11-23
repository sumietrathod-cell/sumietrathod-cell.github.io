-- Staging-only transaction test. Run AFTER schema.sql and rls-policies.sql.
-- All records are synthetic in a temporary table, and all changes roll back.
-- This tests the actual trigger function installed from rls-policies.sql.
begin;
create temp table permission_guard_test (
  organization_id uuid not null,
  contact_id uuid not null,
  channel text not null,
  permission_status text not null,
  evidence_reference text,
  captured_by uuid,
  captured_at timestamptz
);
create trigger permission_guard_test_before
before insert or update on permission_guard_test
for each row execute function public.guard_contact_channel_permission();

do $test$
declare
  org uuid := gen_random_uuid();
  contact uuid := gen_random_uuid();
  actor uuid := gen_random_uuid();
begin
  insert into permission_guard_test(organization_id,contact_id,channel,permission_status)
  values(org,contact,'whatsapp','unknown');

  begin
    update permission_guard_test set permission_status='granted'
    where contact_id=contact;
    raise exception 'FAIL: grant without evidence accepted';
  exception when check_violation then null;
  end;

  update permission_guard_test
  set permission_status='granted', evidence_reference='synthetic-consent-reference',
      captured_by=actor, captured_at=now()
  where contact_id=contact;
  if (select count(*) from permission_guard_test where permission_status='granted') <> 1
    then raise exception 'FAIL: documented grant rejected';
  end if;

  begin
    update permission_guard_test set organization_id=gen_random_uuid()
    where contact_id=contact;
    raise exception 'FAIL: tenant identity could be changed';
  exception when check_violation then null;
  end;

  update permission_guard_test set permission_status='withdrawn'
  where contact_id=contact;
  begin
    update permission_guard_test set permission_status='granted'
    where contact_id=contact;
    raise exception 'FAIL: withdrawn permission could be reinstated';
  exception when check_violation then null;
  end;

  begin
    insert into permission_guard_test(organization_id,contact_id,channel,permission_status)
    values(org,gen_random_uuid(),'voice','granted');
    raise exception 'FAIL: new grant without evidence accepted';
  exception when check_violation then null;
  end;

  if (select count(*) from permission_guard_test where permission_status='withdrawn') <> 1
    then raise exception 'FAIL: withdrawn preference lost';
  end if;
  raise notice 'PASS: five permission guard scenarios';
end
$test$;

select 'PASS: synthetic permission guard test' as result;
rollback;
