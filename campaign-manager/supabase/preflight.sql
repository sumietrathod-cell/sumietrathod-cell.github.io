-- Run this read-only guard BEFORE applying the separate multi-tenant
-- Campaign Manager schema in a fresh staging Supabase project.
--
-- AAROHAN's existing production CRM already has public.campaigns with a
-- different single-admin structure. Never apply this project's CREATE TABLE
-- IF NOT EXISTS schema/tenant RLS scripts to that production database.
--
-- This fails closed if any target table exists in public. It creates nothing,
-- changes no customer data and never schedules outreach.

do $preflight$
declare
  existing_tables text;
begin
  select string_agg(table_name, ', ' order by table_name)
    into existing_tables
  from information_schema.tables
  where table_schema = 'public'
    and table_type = 'BASE TABLE'
    and table_name in (
      'organizations', 'organization_members', 'campaigns', 'contacts',
      'contact_channel_permissions', 'campaign_contacts', 'suppression_list',
      'outreach_attempts', 'audit_events', 'campaign_jobs'
    );
  if existing_tables is not null then
    raise exception 'STOP: target public tables already exist: %', existing_tables
      using errcode = 'P0001',
            hint = 'Use a new isolated staging project. Do NOT overwrite existing AAROHAN Campaign Manager / CRM tables or RLS policies.';
  end if;
end
$preflight$;
