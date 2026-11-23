-- Disposable GitHub Actions PostgreSQL service only.
-- Persistent synthetic fixtures for authenticated PostgREST HTTP tests.
-- Never run this against any connected Supabase customer project.
insert into public.organizations(id,name) values
  ('51000000-0000-4000-8000-000000000001','Fictional REST Tenant Alpha'),
  ('51000000-0000-4000-8000-000000000002','Fictional REST Tenant Beta');

insert into public.organization_members(organization_id,user_id,role) values
  ('51000000-0000-4000-8000-000000000001',
   '00000000-0000-0000-0000-000000000001','operator'),
  ('51000000-0000-4000-8000-000000000002',
   '00000000-0000-0000-0000-000000000002','viewer');

insert into public.contacts(id,organization_id,full_name,phone_e164) values
  ('52000000-0000-4000-8000-000000000001',
   '51000000-0000-4000-8000-000000000001','Fictional Alpha 1','+919999000501'),
  ('52000000-0000-4000-8000-000000000002',
   '51000000-0000-4000-8000-000000000001','Fictional Alpha 2','+919999000502'),
  ('52000000-0000-4000-8000-000000000003',
   '51000000-0000-4000-8000-000000000002','Fictional Beta','+919999000503');

insert into public.campaigns(
  id,organization_id,name,goal,channel,status,dry_run
) values (
  '53000000-0000-4000-8000-000000000001',
  '51000000-0000-4000-8000-000000000001',
  'Synthetic REST draft','No outbound messaging','whatsapp','draft',true
);

insert into public.contact_channel_permissions(
  organization_id,contact_id,channel,permission_status
) values (
  '51000000-0000-4000-8000-000000000001',
  '52000000-0000-4000-8000-000000000001','whatsapp','unknown'
);
