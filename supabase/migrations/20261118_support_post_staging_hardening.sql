-- AAROHAN Support Centre — incremental hardening after staging migration
-- Apply to AAROHAN CRM Staging ONLY after review. This file has NOT been applied.
-- Does not alter existing auth settings, existing customer data or other modules.
-- Original migration may have been applied before its later throttling changes.

create or replace function public.aarohan_support_limit_ticket_creation()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  recent_hour integer;
  recent_day integer;
begin
  if auth.uid() is null or new.customer_id is distinct from auth.uid() then
    raise exception 'Authenticated customer required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.customer_id::text, 42018)
  );

  select count(*) filter (where created_at > now() - interval '1 hour'),
         count(*) filter (where created_at > now() - interval '24 hours')
    into recent_hour, recent_day
  from public.aarohan_support_tickets
  where customer_id = new.customer_id
    and created_at > now() - interval '24 hours';

  if recent_hour >= 8 or recent_day >= 30 then
    raise exception 'Ticket limit reached. Please try again later.';
  end if;
  return new;
end;
$$;
revoke all on function public.aarohan_support_limit_ticket_creation() from public, anon, authenticated;
drop trigger if exists aarohan_support_ticket_rate_limit on public.aarohan_support_tickets;
create trigger aarohan_support_ticket_rate_limit
before insert on public.aarohan_support_tickets
for each row execute function public.aarohan_support_limit_ticket_creation();

-- Limit customer replies, without limiting owner replies or audit events.
create or replace function public.aarohan_support_limit_customer_replies()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  recent_hour integer;
  recent_day integer;
begin
  if new.action <> 'Customer reply' then
    return new;
  end if;
  if auth.uid() is null or new.actor_id is distinct from auth.uid() then
    raise exception 'Authenticated customer required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.actor_id::text, 42019)
  );

  select count(*) filter (where created_at > now() - interval '1 hour'),
         count(*) filter (where created_at > now() - interval '24 hours')
    into recent_hour, recent_day
  from public.aarohan_support_events
  where actor_id = new.actor_id
    and action = 'Customer reply'
    and created_at > now() - interval '24 hours';

  if recent_hour >= 20 or recent_day >= 100 then
    raise exception 'Reply limit reached. Please try again later.';
  end if;
  return new;
end;
$$;
revoke all on function public.aarohan_support_limit_customer_replies() from public, anon, authenticated;
drop trigger if exists aarohan_support_reply_rate_limit on public.aarohan_support_events;
create trigger aarohan_support_reply_rate_limit
before insert on public.aarohan_support_events
for each row execute function public.aarohan_support_limit_customer_replies();

-- Keep event history read-only for customers; writes must use approved RPCs.
revoke all on public.aarohan_support_events from anon, authenticated;
grant select on public.aarohan_support_events to authenticated;

-- Acceptance checks after applying:
-- 1. customer creates <=8 tickets/hour, <=30/day; excess is rejected
-- 2. customer sends <=20 replies/hour, <=100/day; excess is rejected
-- 3. owner status changes and support replies still work
-- 4. two distinct customers cannot see or reply to each other's tickets
-- 5. existing CRM tables and auth redirects remain unchanged
