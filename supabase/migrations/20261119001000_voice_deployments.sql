create table public.voice_deployments (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 100),
  locale text not null default 'en-IN' check (locale in ('en-IN','hi-IN','gu-IN')),
  enabled boolean not null default true,
  operator_user_id uuid references auth.users(id) on delete set null,
  greeting text not null check (length(btrim(greeting)) between 1 and 1000),
  answer text not null check (length(btrim(answer)) between 1 and 2000),
  updated_at timestamptz not null default now()
);

create table public.voice_events (
  id uuid primary key default gen_random_uuid(),
  deployment_id uuid not null references public.voice_deployments(id) on delete restrict,
  event_type text not null check (event_type in ('connected','turn_completed','runtime_error')),
  created_at timestamptz not null default now()
);
create index voice_deployments_operator_idx on public.voice_deployments(operator_user_id) where operator_user_id is not null;
create index voice_events_deployment_time_idx on public.voice_events(deployment_id, created_at desc);

alter table public.voice_deployments enable row level security;
alter table public.voice_events enable row level security;
revoke all on public.voice_deployments, public.voice_events from public, anon, authenticated;
grant select, insert, update on public.voice_deployments to authenticated;
grant select on public.voice_events to authenticated;
grant insert(deployment_id, event_type) on public.voice_events to authenticated;

create policy voice_deployments_admin on public.voice_deployments for all to authenticated
using ((select auth.uid()) is not null and (select auth.jwt()->'app_metadata'->>'campaign_manager_role') = 'admin')
with check ((select auth.uid()) is not null and (select auth.jwt()->'app_metadata'->>'campaign_manager_role') = 'admin');

create policy voice_deployments_assigned on public.voice_deployments for select to authenticated
using (enabled and operator_user_id = (select auth.uid()));

create policy voice_events_admin_read on public.voice_events for select to authenticated
using ((select auth.uid()) is not null and (select auth.jwt()->'app_metadata'->>'campaign_manager_role') = 'admin');

create policy voice_events_runtime on public.voice_events for insert to authenticated
with check (
  exists (select 1 from public.voice_deployments as deployment
    where deployment.id = deployment_id and deployment.enabled and
      (deployment.operator_user_id = (select auth.uid()) or
       ((select auth.uid()) is not null and (select auth.jwt()->'app_metadata'->>'campaign_manager_role') = 'admin')))
);
