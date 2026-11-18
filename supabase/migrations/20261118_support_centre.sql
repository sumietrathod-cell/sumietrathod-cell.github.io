-- AAROHAN AI WORLD Customer Support Centre
-- Review before applying in the Supabase SQL Editor.
-- Authenticated customer access; verified owner-only support desk.
-- No anonymous reads, no public attachment storage, no unverified email-based admin grants.

create or replace function public.aarohan_support_is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users u
    where u.id = (select auth.uid())
      and lower(u.email) = 'aarohananalytics951@gmail.com'
      and u.email_confirmed_at is not null
  );
$$;
revoke all on function public.aarohan_support_is_admin() from public;
grant execute on function public.aarohan_support_is_admin() to authenticated;

create table if not exists public.aarohan_support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique default
    ('AAR-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  customer_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  customer_name text not null check (length(trim(customer_name)) between 1 and 80),
  contact_reference text check (contact_reference is null or length(contact_reference) <= 100),
  service text not null check (length(trim(service)) between 1 and 100),
  category text not null default 'Technical issue' check (category in ('Technical issue','Setup request','Billing question','Feature request','Other')),
  priority text not null default 'Normal' check (priority in ('Low','Normal','High')),
  subject text not null check (length(trim(subject)) between 1 and 140),
  details text not null check (length(trim(details)) between 1 and 3000),
  status text not null default 'Open' check (status in ('Open','In Progress','Waiting for Customer','Resolved','Closed')),
  assigned_to uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists aarohan_support_tickets_customer_idx
  on public.aarohan_support_tickets(customer_id, created_at desc);
create index if not exists aarohan_support_tickets_status_idx
  on public.aarohan_support_tickets(status, created_at desc);

create table if not exists public.aarohan_support_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.aarohan_support_tickets(id) on delete cascade,
  actor_id uuid not null default auth.uid() references auth.users(id),
  action text not null check (length(trim(action)) between 1 and 150),
  note text check (note is null or length(note) <= 800),
  created_at timestamptz not null default now()
);
create index if not exists aarohan_support_events_ticket_idx
  on public.aarohan_support_events(ticket_id, created_at asc);

create or replace function public.aarohan_support_touch_ticket()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists aarohan_support_ticket_touch on public.aarohan_support_tickets;
create trigger aarohan_support_ticket_touch
before update on public.aarohan_support_tickets
for each row execute function public.aarohan_support_touch_ticket();

alter table public.aarohan_support_tickets enable row level security;
alter table public.aarohan_support_events enable row level security;

drop policy if exists "support_customer_select" on public.aarohan_support_tickets;
create policy "support_customer_select"
on public.aarohan_support_tickets for select to authenticated
using (customer_id = (select auth.uid()) or (select public.aarohan_support_is_admin()));

drop policy if exists "support_customer_create" on public.aarohan_support_tickets;
create policy "support_customer_create"
on public.aarohan_support_tickets for insert to authenticated
with check (
  customer_id = (select auth.uid())
  and status = 'Open'
  and assigned_to is null
);

drop policy if exists "support_admin_update" on public.aarohan_support_tickets;
create policy "support_admin_update"
on public.aarohan_support_tickets for update to authenticated
using ((select public.aarohan_support_is_admin()))
with check ((select public.aarohan_support_is_admin()));

drop policy if exists "support_events_read" on public.aarohan_support_events;
create policy "support_events_read"
on public.aarohan_support_events for select to authenticated
using (
  exists (
    select 1 from public.aarohan_support_tickets t
    where t.id = ticket_id
      and (t.customer_id = (select auth.uid()) or (select public.aarohan_support_is_admin()))
  )
);

drop policy if exists "support_admin_add_event" on public.aarohan_support_events;
create policy "support_admin_add_event"
on public.aarohan_support_events for insert to authenticated
with check (
  (select public.aarohan_support_is_admin())
  and actor_id = (select auth.uid())
  and exists (select 1 from public.aarohan_support_tickets t where t.id = ticket_id)
);

revoke all on public.aarohan_support_tickets from anon;
revoke all on public.aarohan_support_events from anon;
grant select, insert on public.aarohan_support_tickets to authenticated;
grant update on public.aarohan_support_tickets to authenticated;
grant select, insert on public.aarohan_support_events to authenticated;

-- IMPORTANT: Do not expose customer tickets on the public static website without
-- Supabase Auth. Add storage attachments only with a private bucket and RLS.
-- Before launch, configure auth redirects, rate limits and email delivery, then
-- test owner/customer isolation with two separate verified accounts.

-- Atomic admin status updates and event history.
create or replace function public.aarohan_support_update_ticket(
  p_ticket_id uuid,
  p_status text,
  p_note text default null
)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  previous_status text;
begin
  if not public.aarohan_support_is_admin() then
    raise exception 'Not authorized';
  end if;
  if p_status is null or p_status not in ('Open','In Progress','Waiting for Customer','Resolved','Closed') then
    raise exception 'Invalid status';
  end if;
  if length(coalesce(p_note,'')) > 800 then
    raise exception 'Note is too long';
  end if;
  select status into previous_status
  from public.aarohan_support_tickets
  where id = p_ticket_id
  for update;
  if not found then
    raise exception 'Ticket not found';
  end if;
  if previous_status = p_status and nullif(trim(coalesce(p_note,'')), '') is null then
    return;
  end if;
  update public.aarohan_support_tickets
  set status = p_status
  where id = p_ticket_id;
  insert into public.aarohan_support_events(ticket_id, actor_id, action, note)
  values (
    p_ticket_id,
    auth.uid(),
    case when previous_status = p_status then 'Internal note'
         else 'Status changed: ' || previous_status || ' -> ' || p_status end,
    nullif(trim(p_note), '')
  );
end;
$$;
revoke all on function public.aarohan_support_update_ticket(uuid,text,text) from public;
grant execute on function public.aarohan_support_update_ticket(uuid,text,text) to authenticated;
