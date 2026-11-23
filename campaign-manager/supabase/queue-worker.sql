-- Durable queue foundation. Apply after schema.sql and rls-policies.sql in staging.
-- This SQL only claims eligible jobs; it does not call any provider and is not a complete worker.
-- Mandatory explicit contact windows and auditable consent metadata now fail closed.
-- Do not schedule it until provider dispatch, callbacks and integration tests exist.
-- A fail-closed stale-claim quarantine below does NOT retry or send any contact.

create table if not exists public.campaign_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_contact_id uuid not null references public.campaign_contacts(id) on delete cascade,
  idempotency_key text not null unique,
  status text not null default 'queued'
    check (status in ('queued','processing','completed','failed','cancelled','skipped')),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  attempts integer not null default 0 check (attempts >= 0),
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_jobs_org_contact_fk
    foreign key (organization_id, campaign_contact_id)
    references public.campaign_contacts(organization_id, id) on delete cascade
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'campaign_jobs_org_contact_fk'
      and conrelid = 'public.campaign_jobs'::regclass
  ) then
    alter table public.campaign_jobs
      add constraint campaign_jobs_org_contact_fk
      foreign key (organization_id, campaign_contact_id)
      references public.campaign_contacts(organization_id, id) on delete cascade;
  end if;
end $$;

create index if not exists idx_campaign_jobs_due
  on public.campaign_jobs(status, available_at, created_at);

-- One active queued/processing attempt per enrolled contact, even if two
-- enqueue requests accidentally use different idempotency keys. This index is
-- a database-level safeguard against concurrent duplicate outbound attempts.
create unique index if not exists idx_campaign_jobs_one_active_per_contact
  on public.campaign_jobs (organization_id, campaign_contact_id)
  where status in ('queued', 'processing');

alter table public.campaign_jobs enable row level security;
-- No authenticated policies: only trusted backend/service-role code may enqueue or claim jobs.

create or replace function public.claim_due_campaign_jobs(
  requested_batch_size integer,
  worker_name text
)
returns table (
  job_id uuid,
  organization_id uuid,
  campaign_contact_id uuid,
  idempotency_key text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if requested_batch_size is null or requested_batch_size < 1 or requested_batch_size > 100 then
    raise exception 'requested_batch_size must be between 1 and 100';
  end if;
  if worker_name is null or length(trim(worker_name)) < 1 or length(worker_name) > 120 then
    raise exception 'worker_name is required (max 120 chars)';
  end if;

  return query
  with candidates as (
    select j.id
    from public.campaign_jobs as j
    join public.campaign_contacts as cc
      on cc.id = j.campaign_contact_id
     and cc.organization_id = j.organization_id
    join public.campaigns as c
      on c.id = cc.campaign_id
     and c.organization_id = j.organization_id
    join public.contacts as ct
      on ct.id = cc.contact_id
     and ct.organization_id = j.organization_id
    where j.status = 'queued'
      and j.available_at <= now()
      and c.status = 'running'
      and c.dry_run = false
      and c.channel in ('voice', 'whatsapp')
      and cc.status in ('queued', 'callback', 'no_answer')
      -- First contact can be unscheduled; retries/callbacks must have an
      -- explicit due time. A future callback can never be claimed early.
      and (
        (cc.status = 'queued' and (cc.next_attempt_at is null or cc.next_attempt_at <= now()))
        or (cc.status in ('callback', 'no_answer')
            and cc.next_attempt_at is not null and cc.next_attempt_at <= now())
      )
      and cc.attempts < c.max_attempts
      and j.attempts < c.max_attempts
      and ct.phone_e164 ~ '^\+[1-9][0-9]{7,14}$'
      and exists (
        select 1
        from public.contact_channel_permissions as p
        where p.organization_id = j.organization_id
          and p.contact_id = ct.id
          and p.channel = c.channel
          and p.permission_status = 'granted'
          and nullif(trim(p.evidence_reference), '') is not null
          and p.captured_at is not null
          and p.captured_at <= now()
          and p.captured_by is not null
      )
      and not exists (
        select 1
        from public.suppression_list as s
        where s.organization_id = j.organization_id
          and (s.contact_id = ct.id or s.phone_e164 = ct.phone_e164)
          and (s.channel is null or s.channel = c.channel)
      )
      -- Fail closed: never interpret an absent time window as 24/7 permission.
      -- Only an explicitly configured non-overnight local window is eligible.
      -- Regulatory quiet hours and recipient-specific time zones still require
      -- independent validation by the future provider worker before any send.
      and c.calling_window_start is not null
      and c.calling_window_end is not null
      and c.calling_window_start < c.calling_window_end
      and (now() at time zone c.timezone)::time >= c.calling_window_start
      and (now() at time zone c.timezone)::time < c.calling_window_end
    order by j.available_at, j.created_at
    limit requested_batch_size
    for update of j skip locked
  ),
  claimed as (
    update public.campaign_jobs as j
       set status = 'processing',
           locked_at = now(),
           locked_by = worker_name,
           attempts = j.attempts + 1,
           updated_at = now()
      from candidates as candidate
     where j.id = candidate.id
    returning j.id, j.organization_id, j.campaign_contact_id, j.idempotency_key
  )
  select claimed.id, claimed.organization_id, claimed.campaign_contact_id, claimed.idempotency_key
  from claimed;
end;
$$;

revoke all on function public.claim_due_campaign_jobs(integer, text) from public, anon, authenticated;
grant execute on function public.claim_due_campaign_jobs(integer, text) to service_role;

-- This starter does not implement stale-lock recovery, provider dispatch, callback handling,
-- or the transaction that records an actual outreach_attempt and updates campaign_contacts.
-- Before dispatch, a future worker MUST repeat eligibility checks immediately before the call/send
-- and apply country-specific regulatory, provider, quiet-hour and platform requirements.
-- This SQL gate is a baseline, not a legal-compliance engine.

-- SAFETY: An abandoned processing claim might have reached a provider before
-- its worker crashed. Automatically requeueing it could send a duplicate.
-- Quarantine old claims into a terminal FAILED state for manual reconciliation.
-- This routine NEVER sends, retries, requeues, or modifies customer permissions.
-- Call only from a privileged, reviewed backend maintenance workflow.
create index if not exists idx_campaign_jobs_stale_claim
  on public.campaign_jobs (locked_at, id)
  where status = 'processing';

create or replace function public.quarantine_stale_campaign_jobs(
  p_stale_after_minutes integer default 30,
  p_batch_size integer default 100
)
returns integer
language plpgsql
security definer
set search_path = ''
as $quarantine$
declare
  affected integer := 0;
begin
  if p_stale_after_minutes is null or p_stale_after_minutes < 15
      or p_stale_after_minutes > 1440 then
    raise exception 'stale interval must be between 15 and 1440 minutes';
  end if;
  if p_batch_size is null or p_batch_size < 1 or p_batch_size > 100 then
    raise exception 'batch size must be between 1 and 100';
  end if;
  with candidates as (
    select j.id
    from public.campaign_jobs j
    where j.status = 'processing'
      and j.locked_at is not null
      and j.locked_at <= now() - make_interval(mins => p_stale_after_minutes)
    order by j.locked_at, j.id
    limit p_batch_size
    for update of j skip locked
  ), quarantined as (
    update public.campaign_jobs j
       set status = 'failed',
           locked_at = null,
           locked_by = null,
           last_error_code = 'stale_claim_needs_manual_review',
           updated_at = now()
      from candidates c
     where j.id = c.id and j.status = 'processing'
    returning j.id
  )
  select count(*) into affected from quarantined;
  return affected;
end;
$quarantine$;

revoke all on function public.quarantine_stale_campaign_jobs(integer, integer)
  from public, anon, authenticated;
grant execute on function public.quarantine_stale_campaign_jobs(integer, integer)
  to service_role;

-- No automatic restart. A future operator must check the provider's delivery
-- status and reconcile the audit before any explicitly reviewed new attempt.
-- This is ONLY a safe quarantine building block, not a running scheduler.
