begin;
revoke all on public.profiles, public.leads, public.deals, public.commissions from public, anon, authenticated;
grant select on public.profiles, public.leads, public.deals, public.commissions to authenticated;
grant insert, update on public.leads, public.deals, public.commissions to authenticated;

create policy leads_admin_insert on public.leads for insert to authenticated with check ((select public.is_active_admin()));
create policy leads_admin_update on public.leads for update to authenticated using ((select public.is_active_admin())) with check ((select public.is_active_admin()));
create policy deals_admin_insert on public.deals for insert to authenticated with check ((select public.is_active_admin()));
create policy deals_admin_update on public.deals for update to authenticated using ((select public.is_active_admin())) with check ((select public.is_active_admin()));
create policy commissions_admin_insert on public.commissions for insert to authenticated with check ((select public.is_active_admin()));
create policy commissions_admin_update on public.commissions for update to authenticated using ((select public.is_active_admin())) with check ((select public.is_active_admin()));

create index if not exists leads_owner_idx on public.leads(owner_partner_id);
create index if not exists deals_lead_idx on public.deals(lead_id);
create index if not exists commissions_partner_idx on public.commissions(partner_id);

-- Future server-side intake records verified delivery IDs for deduplication.
-- Provider payloads and credentials are intentionally excluded.
create table public.crm_integration_receipts (
 provider text not null check (provider in ('website','gmail','whatsapp','voice')),
 delivery_id text not null,
 received_at timestamptz not null default now(),
 primary key (provider, delivery_id)
);
alter table public.crm_integration_receipts enable row level security;
revoke all on public.crm_integration_receipts from public, anon, authenticated;
commit;
