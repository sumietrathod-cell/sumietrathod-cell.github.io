-- AAROHAN AI Campaign Manager: tenant-integrity migration.
-- Apply after the original schema.sql in a STAGING project first.
-- This intentionally fails if existing rows contain cross-organization references;
-- repair/review those rows before retrying. Do not bypass these constraints.

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'campaigns_org_id_id_key') then
    alter table public.campaigns
      add constraint campaigns_org_id_id_key unique (organization_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contacts_org_id_id_key') then
    alter table public.contacts
      add constraint contacts_org_id_id_key unique (organization_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'campaign_contacts_org_id_id_key') then
    alter table public.campaign_contacts
      add constraint campaign_contacts_org_id_id_key unique (organization_id, id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'permissions_org_contact_fk') then
    alter table public.contact_channel_permissions
      add constraint permissions_org_contact_fk
      foreign key (organization_id, contact_id)
      references public.contacts (organization_id, id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'campaign_contacts_org_campaign_fk') then
    alter table public.campaign_contacts
      add constraint campaign_contacts_org_campaign_fk
      foreign key (organization_id, campaign_id)
      references public.campaigns (organization_id, id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'campaign_contacts_org_contact_fk') then
    alter table public.campaign_contacts
      add constraint campaign_contacts_org_contact_fk
      foreign key (organization_id, contact_id)
      references public.contacts (organization_id, id) on delete cascade;
  end if;
  -- Preserve DNC history: contact deletion must not cascade away a suppression record.
  alter table public.suppression_list
    drop constraint if exists suppression_list_contact_id_fkey;
  alter table public.suppression_list
    drop constraint if exists suppression_org_contact_fk;
  alter table public.suppression_list
    add constraint suppression_org_contact_fk
    foreign key (organization_id, contact_id)
    references public.contacts (organization_id, id) on delete restrict;
  if not exists (select 1 from pg_constraint where conname = 'attempts_org_campaign_contact_fk') then
    alter table public.outreach_attempts
      add constraint attempts_org_campaign_contact_fk
      foreign key (organization_id, campaign_contact_id)
      references public.campaign_contacts (organization_id, id) on delete cascade;
  end if;
end $$;
