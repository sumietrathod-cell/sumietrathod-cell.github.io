alter table public.leads add column follow_up_on date;

create function public.campaign_update_lead_progress(
  lead_id uuid,
  next_status text,
  next_follow_up date,
  current_status text,
  current_follow_up date
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  updated_lead record;
begin
  if (select auth.uid()) is null or
     (select auth.jwt() -> 'app_metadata' ->> 'campaign_manager_role') is distinct from 'admin' then
    raise exception 'Campaign Manager admin access required' using errcode = '42501';
  end if;

  if coalesce(length(btrim(next_status)), 0) not between 1 and 100 then
    raise exception 'Status must contain 1 to 100 characters' using errcode = '22023';
  end if;

  if next_follow_up is not null and next_follow_up not between date '1900-01-01' and date '9999-12-31' then
    raise exception 'Invalid follow-up date' using errcode = '22023';
  end if;

  update public.leads
     set status = btrim(next_status), follow_up_on = next_follow_up
   where id = lead_id
     and status is not distinct from current_status
     and follow_up_on is not distinct from current_follow_up
  returning status, follow_up_on into updated_lead;

  if not found then
    return jsonb_build_object('saved', false);
  end if;
  return jsonb_build_object('saved', true, 'status', updated_lead.status, 'follow_up_on', updated_lead.follow_up_on);
end;
$$;

revoke all on function public.campaign_update_lead_progress(uuid, text, date, text, date) from public, anon, authenticated;
grant execute on function public.campaign_update_lead_progress(uuid, text, date, text, date) to authenticated;
