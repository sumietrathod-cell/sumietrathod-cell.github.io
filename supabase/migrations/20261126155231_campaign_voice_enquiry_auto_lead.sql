-- Voice website submissions already pass explicit consent validation in campaign-intake.
-- Only newly received voice enquiries create or link a lead.
create or replace function public.campaign_web_enquiry(
  channel_name text, contact_name text, contact_email text, business text, enquiry text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  normalized_email text := lower(btrim(contact_email));
  matched_lead_id uuid;
begin
  if channel_name is null or channel_name not in ('chatbot','voice') or normalized_email is null then
    raise exception 'Invalid enquiry' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('campaign_inbox_web_rate_limit', 0));
  if (select count(*) from public.campaign_inbox where intake = 'web' and created_at >= now() - interval '10 minutes') >= 30
     or (select count(*) from public.campaign_inbox where intake = 'web' and lower(email) = normalized_email and created_at >= now() - interval '1 hour') >= 3
  then return false;
  end if;

  if channel_name = 'voice' then
    insert into public.leads(name,email,company,source,status)
    values (btrim(contact_name),normalized_email,nullif(btrim(business),''),'Enquiry inbox / voice','New')
    on conflict do nothing returning id into matched_lead_id;

    if matched_lead_id is null then
      select id into matched_lead_id from public.leads
      where lower(btrim(email)) = normalized_email;
    end if;
  end if;

  insert into public.campaign_inbox(channel,name,email,company,message,intake,status,lead_id)
  values (channel_name,btrim(contact_name),normalized_email,nullif(btrim(business),''),btrim(enquiry),'web',
          case when matched_lead_id is null then 'New' else 'Lead saved' end,matched_lead_id);
  return true;
end;
$$;

revoke all on function public.campaign_web_enquiry(text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.campaign_web_enquiry(text,text,text,text,text) to service_role;
