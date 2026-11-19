-- Run in staging after applying schema.sql and rls-policies.sql.
-- Set the UUIDs to two existing Auth test users. Both must have no campaign
-- memberships. The transaction rolls back all synthetic organizations and rows.
begin;

set local aarohan_test.operator_user_id = '00000000-0000-0000-0000-000000000001';
set local aarohan_test.viewer_user_id = '00000000-0000-0000-0000-000000000002';

do $test$
declare
 a uuid := gen_random_uuid();
 b uuid := gen_random_uuid();
 uid_a uuid;
 uid_b uuid;
 d uuid;
begin
 uid_a := current_setting('aarohan_test.operator_user_id')::uuid;
 uid_b := current_setting('aarohan_test.viewer_user_id')::uuid;
 if uid_a = uid_b then raise exception 'Use two distinct test users'; end if;
 if (select count(*) from auth.users where id in (uid_a, uid_b)) <> 2 then
   raise exception 'Set both UUIDs to existing Auth test users';
 end if;
 if exists(select from public.organization_members where user_id in (uid_a, uid_b)) then
   raise exception 'Use test users with no campaign memberships';
 end if;
 insert into public.organizations(id,name) values(a,'Synthetic team A'),(b,'Synthetic team B');
 insert into public.organization_members(organization_id,user_id,role) values(a,uid_a,'operator'),(b,uid_b,'viewer');
 insert into public.campaigns(organization_id,name,goal,channel) values(b,'Synthetic B','Test','manual');
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',uid_a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',uid_a,'role','authenticated')::text,true);
 if (select count(*) from public.organizations) <> 1 or exists(select from public.campaigns where organization_id=b) then raise exception 'Tenant isolation failed'; end if;
 insert into public.campaigns(organization_id,name,goal,channel) values(a,'Synthetic A','Test','manual') returning id into d;
 if not exists(select from public.campaigns where id=d and status='draft' and dry_run) then raise exception 'Draft defaults failed'; end if;
 begin
   insert into public.campaigns(organization_id,name,goal,channel,status,dry_run)
   values(a,'Invalid live campaign','Test','voice','running',false);
   raise exception 'Operator exceeded draft-only access';
 exception when insufficient_privilege then null; end;
 update public.campaigns set status='running',dry_run=false where id=d;
 if not exists(select from public.campaigns where id=d and status='draft' and dry_run) then raise exception 'Client activated campaign'; end if;
 perform set_config('request.jwt.claim.sub',uid_b::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',uid_b,'role','authenticated')::text,true);
 if exists(select from public.campaigns where id=d) then raise exception 'Viewer saw foreign campaign'; end if;
 begin
   insert into public.campaigns(organization_id,name,goal,channel) values(b,'Unexpected','Test','manual');
   raise exception 'Viewer created a campaign';
 exception when insufficient_privilege then null; end;
 execute 'reset role';
end
$test$;

rollback;
select 'PASS: draft-only insert, update guard, tenant isolation and viewer restrictions' as result;
