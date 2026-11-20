create function public.billing_valid_items(items jsonb) returns boolean
language sql immutable strict set search_path='' as $$
 select case when jsonb_typeof(items) <> 'array' then false
 else jsonb_array_length(items) between 1 and 50 and not exists
 (select 1 from jsonb_array_elements(items) i where
 (jsonb_typeof(i)='object' and jsonb_typeof(i->'service')='string'
 and length(trim(i->>'service')) between 1 and 200
 and jsonb_typeof(i->'qty')='number' and (i->>'qty') ~ '^[1-9][0-9]{0,3}$'
 and jsonb_typeof(i->'paise')='number' and (i->>'paise') ~ '^(0|[1-9][0-9]{0,8})$') is not true)
 end $$;
create table public.billing_quotations (
 id uuid primary key, created_at timestamptz not null default now(),
 customer text not null check (length(trim(customer)) between 1 and 160),
 items jsonb not null check(public.billing_valid_items(items))
);
alter table public.billing_quotations enable row level security;
revoke all on public.billing_quotations from public,anon,authenticated;
grant select on public.billing_quotations to authenticated;
grant insert(id,customer,items) on public.billing_quotations to authenticated;
create policy billing_admin_read on public.billing_quotations for select to authenticated using ((auth.jwt()->'app_metadata'->>'campaign_manager_role')='admin');
create policy billing_admin_create on public.billing_quotations for insert to authenticated with check ((auth.jwt()->'app_metadata'->>'campaign_manager_role')='admin');