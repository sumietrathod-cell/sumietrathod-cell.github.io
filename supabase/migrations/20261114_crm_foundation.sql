-- AAROHAN AI WORLD CRM foundation. Apply ONLY to a private Supabase project after review.
-- Never run with production data without migration/backup plan.
create extension if not exists pgcrypto;
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 role text not null default 'partner' check(role in ('admin','partner')),
 display_name text,
 active boolean not null default false
);
create table if not exists public.leads (
 id uuid primary key default gen_random_uuid(),
 owner_partner_id uuid references public.profiles(id),
 company text not null,
 contact_name text,
 source text not null default 'manual',
 consent_status text not null default 'unknown' check(consent_status in ('unknown','granted','withdrawn')),
 status text not null default 'new',
 created_at timestamptz not null default now()
);
create table if not exists public.deals (
 id uuid primary key default gen_random_uuid(),
 lead_id uuid not null references public.leads(id) on delete cascade,
 value numeric(14,2) not null default 0,
 currency text not null default 'INR',
 stage text not null default 'open',
 closed_at timestamptz
);
create table if not exists public.commissions (
 id uuid primary key default gen_random_uuid(),
 deal_id uuid not null references public.deals(id),
 partner_id uuid not null references public.profiles(id),
 amount numeric(14,2) not null check(amount >= 0),
 status text not null default 'pending' check(status in ('pending','approved','paid','rejected'))
);
create or replace function public.is_active_admin() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin' and p.active=true);
$$;
revoke all on function public.is_active_admin() from public;
grant execute on function public.is_active_admin() to authenticated;
alter table public.profiles enable row level security;
alter table public.leads enable row level security;
alter table public.deals enable row level security;
alter table public.commissions enable row level security;
create policy "profiles_read" on public.profiles for select to authenticated using(id=(select auth.uid()) or public.is_active_admin());
create policy "leads_read" on public.leads for select to authenticated using(public.is_active_admin() or (owner_partner_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active=true)));
create policy "deals_read" on public.deals for select to authenticated using(public.is_active_admin() or exists(select 1 from public.leads l where l.id=lead_id and l.owner_partner_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active=true)));
create policy "commissions_read" on public.commissions for select to authenticated using(public.is_active_admin() or (partner_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active=true)));
-- No client-side INSERT/UPDATE/DELETE policies: mutations must use a separately audited backend.
-- Provision the first admin using a privileged backend after verifying ownership; never allow self-promotion.
