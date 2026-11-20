create function public.crm_followup_queue(p_view text,p_offset integer default 0) returns table(id uuid,name text,company text,country text,status text,follow_up_on date)
language plpgsql stable security invoker set search_path='' as $$
declare today date := (now() at time zone 'Asia/Kolkata')::date;
begin
 if auth.uid() is null or (auth.jwt()->'app_metadata'->>'campaign_manager_role') is distinct from 'admin' then raise insufficient_privilege; end if;
 if p_view is null or p_view not in ('today','overdue','unscheduled') or p_offset is null or p_offset<0 then raise exception 'Invalid queue'; end if;
 return query select l.id,l.name,l.company,l.country,l.status,l.follow_up_on from public.leads l where lower(trim(coalesce(l.status,''))) not in ('won','lost','closed')
 and (case p_view when 'today' then l.follow_up_on=today when 'overdue' then l.follow_up_on<today else l.follow_up_on is null end)
 order by l.follow_up_on nulls last,l.created_at nulls last,l.id limit 26 offset p_offset;
end $$;
revoke all on function public.crm_followup_queue(text,integer) from public,anon;
grant execute on function public.crm_followup_queue(text,integer) to authenticated;