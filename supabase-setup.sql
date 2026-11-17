-- AAROHAN AI WORLD Business Suite
-- Run this script in Supabase SQL Editor while signed in as the project owner.
-- Owner access is restricted to the verified account email below.
-- Do not remove RLS or replace the policy with public access.

create extension if not exists pgcrypto;

create table if not exists public.aarohan_customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.aarohan_services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  starting_price numeric(14,2) not null default 0 check (starting_price >= 0),
  currency text not null default 'INR' check (currency in ('INR','USD','EUR')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.aarohan_documents (
  id uuid primary key default gen_random_uuid(),
  document_number text not null unique,
  document_type text not null check (document_type in ('Quotation','Proforma Invoice','Invoice Draft')),
  customer_id uuid references public.aarohan_customers(id) on delete restrict,
  description text not null,
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'INR' check (currency in ('INR','USD','EUR')),
  valid_until date,
  payment_terms text,
  status text not null default 'Open',
  created_at timestamptz not null default now()
);

create table if not exists public.aarohan_payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.aarohan_customers(id) on delete restrict,
  document_id uuid references public.aarohan_documents(id) on delete set null,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'INR' check (currency in ('INR','USD','EUR')),
  method text not null,
  reference text,
  paid_at timestamptz not null default now()
);

create table if not exists public.aarohan_company_settings (
  id boolean primary key default true check (id),
  business_name text not null default 'AAROHAN AI WORLD',
  contact_email text,
  phone text,
  currency text not null default 'INR' check (currency in ('INR','USD','EUR')),
  gstin text,
  pan_encrypted_placeholder text,
  bank_details jsonb,
  updated_at timestamptz not null default now()
);

alter table public.aarohan_customers enable row level security;
alter table public.aarohan_services enable row level security;
alter table public.aarohan_documents enable row level security;
alter table public.aarohan_payments enable row level security;
alter table public.aarohan_company_settings enable row level security;

-- Restrict every table operation to the business owner's authenticated account.
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'aarohan_customers',
    'aarohan_services',
    'aarohan_documents',
    'aarohan_payments',
    'aarohan_company_settings'
  ] loop
    execute format('drop policy if exists "AAROHAN owner only" on public.%I', tbl);
    execute format(
      'create policy "AAROHAN owner only" on public.%I for all to authenticated using ((auth.jwt() ->> ''email'') = ''aarohananalytics951@gmail.com'') with check ((auth.jwt() ->> ''email'') = ''aarohananalytics951@gmail.com'')',
      tbl
    );
  end loop;
end $$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.aarohan_customers,
  public.aarohan_services,
  public.aarohan_documents,
  public.aarohan_payments,
  public.aarohan_company_settings
to authenticated;

-- Seed the initial service catalogue (safe to re-run).
insert into public.aarohan_services (name, description, starting_price)
select v.name, v.description, 0
from (values
 ('AI Chatbot & Customer Support','AI-powered website customer support'),
 ('WhatsApp Business Automation','WhatsApp enquiry and workflow automation'),
 ('Voice AI Agent','Multilingual voice assistant and call automation'),
 ('CRM & Lead Management','Lead tracking, follow-ups and CRM setup'),
 ('Custom Software & Website','Business websites and custom software'),
 ('Pharma QA Analytics & Tools','Pharma QA dashboards, reports and tools'),
 ('Power BI & Excel Automation','Business intelligence and spreadsheet automation'),
 ('SEO & Digital Growth','Search visibility and digital growth services'),
 ('AI Campaign Automation','Campaign operations and lead follow-up automation')
) as v(name, description)
where not exists (
  select 1 from public.aarohan_services s where s.name = v.name
);
