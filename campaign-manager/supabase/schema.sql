-- AAROHAN AI Campaign Manager: initial PostgreSQL/Supabase schema draft.
-- Apply only after reviewing in a staging project. This file intentionally does not
-- create permissive policies; authenticated access is denied until RLS policies are added.
-- Tenant permissions, enrolled contacts, campaigns and outreach attempts preserve
-- linked evidence via ON DELETE RESTRICT. A direct DELETE cannot silently
-- cascade away consent history or recorded contact/campaign activity.
-- A future authorized retention/deletion workflow must handle privacy laws,
-- audit requirements and explicit business approval; do not bypass this guard.

create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','operator','viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  goal text not null,
  channel text not null check (channel in ('voice','whatsapp','manual')),
  status text not null default 'draft'
    check (status in ('draft','scheduled','running','paused','completed','cancelled')),
  timezone text not null default 'Asia/Kolkata',
  calling_window_start time,
  calling_window_end time,
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  retry_interval_minutes integer not null default 1440 check (retry_interval_minutes between 15 and 43200),
  dry_run boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaigns_org_id_id_key unique (organization_id, id)
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text,
  phone_e164 text,
  email text,
  source text,
  created_at timestamptz not null default now(),
  unique (organization_id, phone_e164),
  constraint contacts_org_id_id_key unique (organization_id, id)
);

create table if not exists public.contact_channel_permissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete restrict,
  channel text not null check (channel in ('voice','whatsapp','email')),
  permission_status text not null check (permission_status in ('granted','unknown','withdrawn')),
  evidence_reference text,
  captured_at timestamptz,
  captured_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (contact_id, channel),
  constraint permissions_org_contact_fk foreign key (organization_id, contact_id)
    references public.contacts(organization_id, id) on delete restrict
);

create table if not exists public.campaign_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  contact_id uuid not null references public.contacts(id) on delete restrict,
  status text not null default 'queued'
    check (status in ('queued','in_progress','reached','qualified','callback','no_answer','do_not_contact','failed','skipped')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz,
  last_outcome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, contact_id),
  constraint campaign_contacts_org_id_id_key unique (organization_id, id),
  constraint campaign_contacts_org_campaign_fk foreign key (organization_id, campaign_id)
    references public.campaigns(organization_id, id) on delete restrict,
  constraint campaign_contacts_org_contact_fk foreign key (organization_id, contact_id)
    references public.contacts(organization_id, id) on delete restrict
);

create table if not exists public.suppression_list (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete restrict,
  phone_e164 text,
  channel text check (channel in ('voice','whatsapp','email') or channel is null),
  reason text not null,
  source text,
  created_at timestamptz not null default now(),
  check (contact_id is not null or phone_e164 is not null),
  constraint suppression_org_contact_fk foreign key (organization_id, contact_id)
    references public.contacts(organization_id, id) on delete restrict
);

create table if not exists public.outreach_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_contact_id uuid not null references public.campaign_contacts(id) on delete restrict,
  channel text not null check (channel in ('voice','whatsapp','email','manual')),
  provider text,
  provider_reference text,
  status text not null default 'queued'
    check (status in ('queued','started','completed','failed','cancelled')),
  outcome text,
  summary text,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_reference),
  constraint attempts_org_campaign_contact_fk foreign key (organization_id, campaign_contact_id)
    references public.campaign_contacts(organization_id, id) on delete restrict
);

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_campaigns_org_status on public.campaigns(organization_id, status);
create index if not exists idx_campaign_contacts_due on public.campaign_contacts(status, next_attempt_at);
create index if not exists idx_contacts_org_phone on public.contacts(organization_id, phone_e164);
create index if not exists idx_suppression_org_phone on public.suppression_list(organization_id, phone_e164);

-- One durable suppression per enrolled contact and channel. Retries and
-- repeated withdrawals must NOT insert duplicate suppression history rows.
-- PostgreSQL UNIQUE treats NULL contact IDs/channels as distinct, so this
-- does not prevent general phone-only or all-channel suppression records.
-- Audit events remain separate from this durable current-state record.
create unique index if not exists idx_suppression_contact_channel_unique
  on public.suppression_list (contact_id, channel);

create index if not exists idx_attempts_campaign_contact on public.outreach_attempts(campaign_contact_id, created_at desc);
create index if not exists idx_audit_org_created on public.audit_events(organization_id, created_at desc);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.campaigns enable row level security;
alter table public.contacts enable row level security;
alter table public.contact_channel_permissions enable row level security;
alter table public.campaign_contacts enable row level security;
alter table public.suppression_list enable row level security;
alter table public.outreach_attempts enable row level security;
alter table public.audit_events enable row level security;

-- RLS is enabled but policies are intentionally not yet granted. Add and test
-- membership-based policies before connecting a frontend or exposing any data.
