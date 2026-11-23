-- REAL PostgreSQL RLS exercise in the disposable CI database.
-- Local Supabase auth simulation lives in ci-auth-bootstrap.sql.
-- All tenant data is fictional and this test rolls back.
begin;
insert into public.organizations(id, name) values
 ('10000000-0000-4000-8000-000000000001', 'Synthetic Operator Org'),
 ('10000000-0000-4000-8000-000000000002', 'Synthetic Viewer Org');
insert into public.organization_members(organization_id, user_id, role) values
 ('10000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000001', 'operator'),
 ('10000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000002', 'viewer');
insert into public.contacts(id, organization_id, full_name, phone_e164) values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Synthetic A', '+919999000001'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','Synthetic B', '+919999000002');
insert into public.contact_channel_permissions(
 id, organization_id, contact_id, channel, permission_status
) values(
 '30000000-0000-4000-8000-000000000001',
 '10000000-0000-4000-8000-000000000001',
 '20000000-0000-4000-8000-000000000001','whatsapp','unknown'
);
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',true);

do $verify_a$
declare
  blocked boolean;
  change_count integer;
begin
  if (select count(*) from public.organizations) <> 1 then
    raise exception 'FAIL: Operator sees another organization';
  end if;
  if (select count(*) from public.contacts) <> 1 then
    raise exception 'FAIL: Operator sees another tenant contact';
  end if;
  if exists(select 1 from public.contacts where organization_id='10000000-0000-4000-8000-000000000002') then
    raise exception 'FAIL: leaked contact B';
  end if;
  if (select count(*) from public.contact_channel_permissions) <> 1 then
    raise exception 'FAIL: Operator permission read scope';
  end if;
  -- Authenticated operators cannot grant permission via CSV-supplied text or
  -- a direct REST call, even when they manufacture plausible evidence.
  update public.contact_channel_permissions
  set permission_status='granted', evidence_reference=null,
      captured_by=null, captured_at=null
  where id='30000000-0000-4000-8000-000000000001';
  get diagnostics change_count = row_count;
  if change_count <> 0 then
    raise exception 'FAIL: operator granted permission with missing evidence';
  end if;
  update public.contact_channel_permissions
  set permission_status='granted',
      evidence_reference='synthetic-self-asserted-proof-is-not-verified',
      captured_by='00000000-0000-0000-0000-000000000001',
      captured_at=now()
  where id='30000000-0000-4000-8000-000000000001';
  get diagnostics change_count = row_count;
  if change_count <> 0 then
    raise exception 'FAIL: operator forged a grant despite apparently complete evidence';
  end if;
  blocked:=false;
  begin
    insert into public.contact_channel_permissions(
      organization_id,contact_id,channel,permission_status,
      evidence_reference,captured_at,captured_by
    ) values (
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      'voice','granted','synthetic-fake-source',now(),
      '00000000-0000-0000-0000-000000000001'
    );
  exception when insufficient_privilege then blocked:=true;
  end;
  if not blocked then
    raise exception 'FAIL: operator inserted forged granted permission';
  end if;
  update public.contact_channel_permissions
  set permission_status='withdrawn'
  where id='30000000-0000-4000-8000-000000000001';
  get diagnostics change_count = row_count;
  if change_count <> 1 then
    raise exception 'FAIL: legitimate withdrawal should still work';
  end if;
  blocked:=false;
  begin
    update public.contact_channel_permissions
    set permission_status='granted'
    where id='30000000-0000-4000-8000-000000000001';
  exception when check_violation then blocked:=true;
  end;
  if not blocked then
    -- With UPDATE RLS removed, a blocked update may silently affect zero rows.
    if (select permission_status from public.contact_channel_permissions
        where id='30000000-0000-4000-8000-000000000001') <> 'withdrawn' then
      raise exception 'FAIL: withdrawn permission reinstated';
    end if;
  end if;

  delete from public.contact_channel_permissions
  where id='30000000-0000-4000-8000-000000000001';
  get diagnostics change_count = row_count;
  if change_count <> 0 then
    raise exception 'FAIL: signed-in operator can DELETE permission history';
  end if;
  if (select permission_status from public.contact_channel_permissions
      where id='30000000-0000-4000-8000-000000000001') <> 'withdrawn' then
    raise exception 'FAIL: removed opt-out';
  end if;
  -- Even an operator must not be able to modify another tenant's contact.
  update public.contacts set full_name='CROSS TENANT'
  where id='20000000-0000-4000-8000-000000000002';
  get diagnostics change_count = row_count;
  if change_count <> 0 then
    raise exception 'FAIL: cross-tenant UPDATE succeeded';
  end if;
end
$verify_a$;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}',true);

do $verify_b$
declare denied boolean;
begin
  if (select count(*) from public.organizations) <> 1 then
    raise exception 'FAIL: Viewer sees another organization';
  end if;
  if (select count(*) from public.contacts) <> 1 then
    raise exception 'FAIL: Viewer sees another tenant contact';
  end if;
  if exists(select 1 from public.contact_channel_permissions
     where id='30000000-0000-4000-8000-000000000001') then
    raise exception 'FAIL: Viewer reads another tenant permission';
  end if;
  denied:=false;
  begin
    insert into public.contact_channel_permissions(
      organization_id,contact_id,channel,permission_status,
      evidence_reference,captured_at,captured_by
    ) values(
      '10000000-0000-4000-8000-000000000002',
      '20000000-0000-4000-8000-000000000002','whatsapp',
      'granted','synthetic-evidence',now(),
      '00000000-0000-0000-0000-000000000002'
    );
  exception when insufficient_privilege then denied:=true;
  end;
  if not denied then
    raise exception 'FAIL: Viewer was allowed to grant contact permission';
  end if;
end
$verify_b$;
reset role;
select 'PASS: real PostgreSQL RLS tenant isolation and irreversible opt-out' as result;
rollback;
