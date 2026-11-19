create table public.campaign_inbox (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('chatbot', 'voice', 'whatsapp')),
  name text not null check (length(btrim(name)) between 1 and 120),
  email text check (email is null or (length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
  phone text check (phone is null or (length(phone) <= 40 and length(regexp_replace(phone, '[^0-9]', '', 'g')) between 5 and 20)),
  company text check (length(company) <= 200),
  message text not null check (length(btrim(message)) between 1 and 2000),
  intake text not null default 'manual' check (intake in ('manual', 'web', 'provider')),
  external_id text unique check (length(external_id) <= 240),
  status text not null default 'New' check (status in ('New','Reviewed','Lead saved')),
  lead_id uuid references public.leads(id) on delete set null,
  created_at timestamptz not null default now(),
  check (email is not null or phone is not null)
);
create index campaign_inbox_latest_idx on public.campaign_inbox (created_at desc, id);
create index campaign_inbox_web_email_idx on public.campaign_inbox (lower(email), created_at desc) where intake = 'web';

alter table public.campaign_inbox enable row level security;
revoke all on public.campaign_inbox from public, anon, authenticated;
grant select, insert, update on public.campaign_inbox to authenticated;
grant select, insert on public.campaign_inbox to service_role;

create policy campaign_inbox_admin on public.campaign_inbox for all to authenticated
using ((select auth.uid()) is not null and (select auth.jwt()->'app_metadata'->>'campaign_manager_role') = 'admin')
with check ((select auth.uid()) is not null and (select auth.jwt()->'app_metadata'->>'campaign_manager_role') = 'admin');

create function public.campaign_web_enquiry(
  channel_name text, contact_name text, contact_email text, business text, enquiry text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  normalized_email text := lower(btrim(contact_email));
begin
  if channel_name is null or channel_name not in ('chatbot','voice') or normalized_email is null then
    raise exception 'Invalid enquiry' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('campaign_inbox_web_rate_limit', 0));
  if (select count(*) from public.campaign_inbox where intake = 'web' and created_at >= now() - interval '10 minutes') >= 30
     or (select count(*) from public.campaign_inbox where intake = 'web' and lower(email) = normalized_email and created_at >= now() - interval '1 hour') >= 3
  then return false;
  end if;
  insert into public.campaign_inbox(channel,name,email,company,message,intake)
  values (channel_name,btrim(contact_name),normalized_email,nullif(btrim(business),''),btrim(enquiry),'web');
  return true;
end;
$$;

revoke all on function public.campaign_web_enquiry(text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.campaign_web_enquiry(text,text,text,text,text) to service_role;

create function public.campaign_inbox_save_lead(enquiry_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item public.campaign_inbox%rowtype;
  matched_id uuid;
  candidates uuid[];
begin
  if (select auth.uid()) is null or
     (select auth.jwt() -> 'app_metadata' ->> 'campaign_manager_role') is distinct from 'admin' then
    raise exception 'Campaign Manager admin access required' using errcode = '42501';
  end if;

  select * into item from public.campaign_inbox where id = enquiry_id for update;
  if not found then return jsonb_build_object('result','missing'); end if;
  if item.lead_id is not null then
    return jsonb_build_object('result','existing','lead_id',item.lead_id);
  end if;

  insert into public.leads(name,email,phone,company,source,status)
  values(item.name,item.email,item.phone,item.company,'Enquiry inbox / ' || item.channel,'New')
  on conflict do nothing returning id into matched_id;

  if matched_id is null then
    select array_agg(distinct id) into candidates from public.leads
      where (item.email is not null and lower(btrim(email)) = lower(btrim(item.email)))
         or (item.phone is not null and regexp_replace(phone, '[^0-9]', '', 'g') = regexp_replace(item.phone, '[^0-9]', '', 'g'));
    if coalesce(cardinality(candidates),0) <> 1 then
      return jsonb_build_object('result','conflict');
    end if;
    matched_id := candidates[1];
  end if;

  update public.campaign_inbox set lead_id = matched_id, status = 'Lead saved' where id = enquiry_id;
  return jsonb_build_object('result','saved','lead_id',matched_id);
end;
$$;

revoke all on function public.campaign_inbox_save_lead(uuid) from public, anon, authenticated;
grant execute on function public.campaign_inbox_save_lead(uuid) to authenticated;
