-- AAROHAN AI WORLD Business Suite - Supabase starter schema
-- Run only after creating a Supabase project. This schema uses app_metadata.role='owner'
-- for privileged access. Set this claim from a trusted admin process, never from the client.
create extension if not exists pgcrypto;
create table if not exists public.business_profiles (
  id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references auth.users(id) on delete cascade,
  business_name text not null default 'AAROHAN AI WORLD', contact_email text, phone text,
  currency text not null default 'INR' check (currency in ('INR','USD','EUR')),
  gstin text, pan_encrypted text, bank_details_encrypted text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, email text, phone text, company text, notes text, created_at timestamptz not null default now()
);
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, description text, price numeric(14,2) not null default 0 check(price>=0),
  currency text not null default 'INR', active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null, document_number text not null,
  document_type text not null check(document_type in ('quotation','proforma_invoice','invoice','receipt')),
  status text not null default 'draft', currency text not null default 'INR',
  subtotal numeric(14,2) not null default 0, tax_rate numeric(7,4) not null default 0,
  tax_amount numeric(14,2) not null default 0, total numeric(14,2) not null default 0,
  valid_until date, terms text, line_items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(), unique(owner_user_id,document_number)
);
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null, document_id uuid references public.documents(id) on delete set null,
  amount numeric(14,2) not null check(amount>0), currency text not null default 'INR',
  method text not null, reference text, paid_at timestamptz not null default now()
);
create table if not exists public.client_feedback (
  id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references auth.users(id) on delete cascade,
  customer_name text, business_name text, feedback text not null, permission_to_publish boolean not null default false,
  approved boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.partner_commissions (
  id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references auth.users(id) on delete cascade,
  partner_name text not null, document_id uuid references public.documents(id) on delete set null,
  amount numeric(14,2) not null default 0, status text not null default 'pending', created_at timestamptz not null default now()
);
alter table public.business_profiles enable row level security;
alter table public.customers enable row level security;
alter table public.services enable row level security;
alter table public.documents enable row level security;
alter table public.payments enable row level security;
alter table public.client_feedback enable row level security;
alter table public.partner_commissions enable row level security;
-- Owner-only policies. app_metadata.role must be assigned by a trusted server/admin.
do $$ declare t text; begin
 foreach t in array array['business_profiles','customers','services','documents','payments','client_feedback','partner_commissions'] loop
  execute format('drop policy if exists owner_all on public.%I',t);
  execute format('create policy owner_all on public.%I for all to authenticated using (owner_user_id = auth.uid() and (auth.jwt()->''app_metadata''->>''role'') = ''owner'') with check (owner_user_id = auth.uid() and (auth.jwt()->''app_metadata''->>''role'') = ''owner'')',t);
 end loop;
end $$;
