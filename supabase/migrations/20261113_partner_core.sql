-- AAROHAN AI WORLD Partner Portal - secure Supabase foundation
-- NOT applied until Supabase is connected. Run in a private Supabase SQL Editor.
-- Never expose a Supabase secret/service_role key or this database to GitHub Pages.

begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table if not exists public.partner_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  company_name text,
  whatsapp text,
  country text,
  territory text,
  role text not null default 'partner' check (role in ('partner','admin')),
  status text not null default 'pending' check (status in ('pending','review','approved','rejected','suspended')),
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

create or replace function private.create_partner_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.partner_profiles(id,email,full_name)
  values(new.id,coalesce(new.email,''),nullif(trim(new.raw_user_meta_data->>'full_name'),''))
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_aarohan_auth_user_created on auth.users;
create trigger on_aarohan_auth_user_created
after insert on auth.users for each row execute function private.create_partner_profile();

create or replace function private.is_partner_admin()
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(
   select 1 from public.partner_profiles p
   where p.id=(select auth.uid()) and p.role='admin' and p.status='approved'
 );
$$;
create or replace function private.is_approved_partner()
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(
   select 1 from public.partner_profiles p
   where p.id=(select auth.uid()) and p.role='partner' and p.status='approved'
 );
$$;
revoke all on function private.is_partner_admin() from public;
revoke all on function private.is_approved_partner() from public;
grant execute on function private.is_partner_admin() to authenticated;
grant execute on function private.is_approved_partner() to authenticated;

create table if not exists public.partner_applications (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null unique references public.partner_profiles(id) on delete cascade,
  full_name text not null,
  company_name text,
  whatsapp text not null,
  country text not null,
  territory text,
  experience text,
  industries text,
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists partner_applications_partner_idx on public.partner_applications(partner_id);

create table if not exists public.partner_leads (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_profiles(id),
  client_company text not null,
  contact_person text,
  business_email text,
  business_phone text,
  country text,
  industry text,
  service text not null,
  stage text not null default 'new' check (stage in ('new','contacted','demo','proposal','negotiation','won','lost')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists partner_leads_partner_idx on public.partner_leads(partner_id);
create index if not exists partner_leads_business_email_idx on public.partner_leads(lower(business_email));

create table if not exists public.partner_deals (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.partner_leads(id),
  partner_id uuid not null references public.partner_profiles(id),
  client_company text not null,
  invoice_reference text,
  currency text not null default 'INR',
  paid_ex_tax numeric(14,2) not null default 0 check (paid_ex_tax >= 0),
  agreed_eligible_costs numeric(14,2) not null default 0 check (agreed_eligible_costs >= 0),
  rate numeric(5,4) not null default 0 check (rate >= 0 and rate <= 1),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','partial','paid','refunded')),
  approval_status text not null default 'review' check (approval_status in ('review','approved','rejected','on_hold')),
  created_at timestamptz not null default now(),
  approved_at timestamptz
);
create index if not exists partner_deals_partner_idx on public.partner_deals(partner_id);

create table if not exists public.partner_commissions (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null unique references public.partner_deals(id),
  partner_id uuid not null references public.partner_profiles(id),
  approved_amount numeric(14,2) not null default 0 check (approved_amount >= 0),
  paid_amount numeric(14,2) not null default 0 check (paid_amount >= 0),
  status text not null default 'pending' check (status in ('pending','approved','on_hold','paid','cancelled')),
  transfer_reference text,
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  constraint partner_commissions_not_overpaid check (paid_amount <= approved_amount)
);
create index if not exists partner_commissions_partner_idx on public.partner_commissions(partner_id);

-- Permission grants and RLS: anonymous callers have NO table privileges.
alter table public.partner_profiles enable row level security;
alter table public.partner_applications enable row level security;
alter table public.partner_leads enable row level security;
alter table public.partner_deals enable row level security;
alter table public.partner_commissions enable row level security;
revoke all on table public.partner_profiles,public.partner_applications,public.partner_leads,public.partner_deals,public.partner_commissions from anon;
grant select,update on public.partner_profiles to authenticated;
grant select,insert,update on public.partner_applications to authenticated;
grant select,insert,update on public.partner_leads to authenticated;
grant select,insert,update on public.partner_deals to authenticated;
grant select,insert,update on public.partner_commissions to authenticated;

create policy "profiles_read_self_or_admin" on public.partner_profiles for select to authenticated
using (id=(select auth.uid()) or (select private.is_partner_admin()));
create policy "profiles_admin_update" on public.partner_profiles for update to authenticated
using ((select private.is_partner_admin())) with check ((select private.is_partner_admin()));

create policy "applications_read_self_or_admin" on public.partner_applications for select to authenticated
using (partner_id=(select auth.uid()) or (select private.is_partner_admin()));
create policy "applications_insert_self" on public.partner_applications for insert to authenticated
with check (partner_id=(select auth.uid()));
create policy "applications_admin_update" on public.partner_applications for update to authenticated
using ((select private.is_partner_admin())) with check ((select private.is_partner_admin()));

create policy "leads_read_owner_or_admin" on public.partner_leads for select to authenticated
using (partner_id=(select auth.uid()) or (select private.is_partner_admin()));
create policy "leads_partner_insert" on public.partner_leads for insert to authenticated
with check (partner_id=(select auth.uid()) and (select private.is_approved_partner()));
create policy "leads_owner_update" on public.partner_leads for update to authenticated
using (partner_id=(select auth.uid()) and (select private.is_approved_partner()))
with check (partner_id=(select auth.uid()) and (select private.is_approved_partner()));
create policy "leads_admin_update" on public.partner_leads for update to authenticated
using ((select private.is_partner_admin())) with check ((select private.is_partner_admin()));

create policy "deals_read_partner_or_admin" on public.partner_deals for select to authenticated
using (partner_id=(select auth.uid()) or (select private.is_partner_admin()));
create policy "deals_admin_insert" on public.partner_deals for insert to authenticated
with check ((select private.is_partner_admin()));
create policy "deals_admin_update" on public.partner_deals for update to authenticated
using ((select private.is_partner_admin())) with check ((select private.is_partner_admin()));

create policy "commissions_read_partner_or_admin" on public.partner_commissions for select to authenticated
using (partner_id=(select auth.uid()) or (select private.is_partner_admin()));
create policy "commissions_admin_insert" on public.partner_commissions for insert to authenticated
with check ((select private.is_partner_admin()));
create policy "commissions_admin_update" on public.partner_commissions for update to authenticated
using ((select private.is_partner_admin())) with check ((select private.is_partner_admin()));

commit;
