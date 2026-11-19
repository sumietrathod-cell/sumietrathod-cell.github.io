create table public.aarohi_calls (
  conversation_id text primary key check (conversation_id ~ '^conv_[A-Za-z0-9_-]{5,150}$'),
  started_at timestamptz not null,
  duration_seconds integer check (duration_seconds between 0 and 86400),
  status text not null check (status in ('initiated', 'in-progress', 'processing', 'done', 'failed')),
  language text check (language ~ '^[A-Za-z]{2,3}([_-][A-Za-z0-9]{2,8}){0,3}$'),
  source text check (source ~ '^[A-Za-z0-9_-]{1,40}$'),
  synced_at timestamptz not null default now()
);
create index aarohi_calls_recent_idx on public.aarohi_calls(started_at desc, conversation_id);

alter table public.aarohi_calls enable row level security;
revoke all on public.aarohi_calls from public, anon, authenticated;
grant select on public.aarohi_calls to authenticated;
grant select, insert, update on public.aarohi_calls to service_role;
create policy aarohi_calls_admin_read on public.aarohi_calls for select to authenticated
using ((select auth.uid()) is not null and (select auth.jwt()->'app_metadata'->>'campaign_manager_role') = 'admin');
