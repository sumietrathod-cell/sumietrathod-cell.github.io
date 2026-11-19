create function public.campaign_partner_sales_summary()
returns table(sale_count bigint, sales_inr numeric, earned_inr numeric)
language sql stable security definer set search_path = '' as $$
  select count(s.reference), coalesce(sum(s.amount_inr),0),
         coalesce(sum(round(s.amount_inr*s.commission_rate/100,2)),0)
  from public.partners p
  left join public.campaign_sales s on s.partner_id=p.id
  where p.auth_user_id=auth.uid() and lower(p.status)='active'
  having count(p.id)>0
$$;
revoke all on function public.campaign_partner_sales_summary() from public,anon;
grant execute on function public.campaign_partner_sales_summary() to authenticated;
