-- REVIEW-ONLY release candidate — NOT deployed, NOT automatically migrated.
-- Source: previously deployed supabase/migrations/20261119004000_campaign_sales_followup_report.sql.
-- This patch adds a non-null auth.uid() guard to two privileged Admin RPCs.
-- Do not ALTER owner, RLS, grants, or change SECURITY DEFINER to INVOKER blindly:
-- these functions intentionally read/write public.campaign_sales, which is RPC-only.
-- Route through reviewed 'supabase migration new <name>' prior to deployment.
-- It does not fix all security-advisor warnings and is NOT proof of production readiness.

create or replace function public.campaign_record_sale(p_lead uuid, p_reference text, p_amount numeric) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  ref text := upper(trim(p_reference));
  inserted integer;
begin
  if auth.uid() is null or (auth.jwt()->'app_metadata'->>'campaign_manager_role') is distinct from 'admin' then
    raise insufficient_privilege;
  end if;
  if ref is null or ref !~ '^[A-Z0-9][A-Z0-9_./-]{0,99}$' or p_amount is null or p_amount <= 0 or p_amount > 999999999999.99 or p_amount <> round(p_amount,2) then
    raise exception 'Invalid sale';
  end if;
  insert into public.campaign_sales(reference, lead_id, amount_inr, partner_id, commission_rate)
    select ref,l.id,p_amount,l.partner_id,case when l.partner_id is null then 0 else p.commission_rate end
    from public.leads l left join public.partners p on p.id=l.partner_id where l.id=p_lead
    on conflict(reference) do nothing;
  get diagnostics inserted = row_count;
  if inserted=0 and not exists(select from public.campaign_sales where reference=ref and lead_id=p_lead and amount_inr=p_amount) then
    raise exception 'Check lead and reference';
  end if;
  return inserted=1;
end $$;

create or replace function public.campaign_admin_report() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if auth.uid() is null or (auth.jwt()->'app_metadata'->>'campaign_manager_role') is distinct from 'admin' then
    raise insufficient_privilege;
  end if;
  return jsonb_build_object(
    'today',today,
    'followups',coalesce((select jsonb_agg(to_jsonb(d) order by d.follow_up_on,d.id) from
      (select id,name,follow_up_on from public.leads where follow_up_on <= today and lower(trim(coalesce(status,''))) not in ('won','closed','lost') order by follow_up_on,id limit 100) d),'[]'::jsonb),
    'pipeline',coalesce((select jsonb_object_agg(stage,n) from
      (select coalesce(nullif(trim(status),''),'Unspecified') stage,count(*) n from public.leads group by 1) counts),'{}'::jsonb),
    'sales', (select jsonb_build_object('count',count(*),'amount',coalesce(sum(amount_inr),0),'commission',coalesce(sum(round(amount_inr*commission_rate/100,2)),0)) from public.campaign_sales),
    'partners',coalesce((select jsonb_agg(to_jsonb(t) order by t.name,t.partner_id) from
      (select s.partner_id,p.name,sum(s.amount_inr) amount,sum(round(s.amount_inr*s.commission_rate/100,2)) commission from public.campaign_sales s join public.partners p on p.id=s.partner_id group by s.partner_id,p.name) t),'[]'::jsonb)
  );
end $$;

-- Preserve the existing limited execution grants. This is a defense-in-depth check.
revoke all on function public.campaign_record_sale(uuid,text,numeric),public.campaign_admin_report() from public, anon;
grant execute on function public.campaign_record_sale(uuid,text,numeric),public.campaign_admin_report() to authenticated;
