create table public.agent_support_cases (
 id uuid primary key, customer_id uuid not null default auth.uid(),
 deployment_id uuid not null references public.voice_deployments(id),
 issue text not null check(length(trim(issue)) between 1 and 1500),
 status text not null default 'Open' check(status in ('Open','Waiting for customer','Resolved')),
 created_at timestamptz not null default now()
);
create table public.agent_support_replies (
 id uuid primary key, case_id uuid not null references public.agent_support_cases(id),
 author_id uuid not null default auth.uid(), body text not null check(length(trim(body)) between 1 and 1500),
 created_at timestamptz not null default now()
);
alter table public.agent_support_cases enable row level security;
alter table public.agent_support_replies enable row level security;
revoke all on public.agent_support_cases,public.agent_support_replies from public,anon,authenticated;
grant select,insert(id,deployment_id,issue),update(status) on public.agent_support_cases to authenticated;
grant select,insert(id,case_id,body) on public.agent_support_replies to authenticated;
create policy view_case on public.agent_support_cases for select to authenticated using(customer_id=auth.uid() or auth.jwt()->'app_metadata'->>'campaign_manager_role'='admin');
create policy open_case on public.agent_support_cases for insert to authenticated with check(customer_id=auth.uid() and exists(select 1 from public.voice_deployments d where d.id=deployment_id and (d.operator_user_id=auth.uid() or auth.jwt()->'app_metadata'->>'campaign_manager_role'='admin')));
create policy manage_case on public.agent_support_cases for update to authenticated using(auth.jwt()->'app_metadata'->>'campaign_manager_role'='admin') with check(auth.jwt()->'app_metadata'->>'campaign_manager_role'='admin');
create policy view_reply on public.agent_support_replies for select to authenticated using(exists(select 1 from public.agent_support_cases c where c.id=case_id));
create policy add_reply on public.agent_support_replies for insert to authenticated with check(author_id=auth.uid() and exists(select 1 from public.agent_support_cases c where c.id=case_id and c.status<>'Resolved'));
create index on public.agent_support_cases(customer_id,created_at);
create index on public.agent_support_replies(case_id,created_at);
create function public.support_set_agent_language(p_case uuid,p_locale text) returns void language plpgsql security definer set search_path='' as $$
declare c public.agent_support_cases; previous text;
begin
 if auth.uid() is null or p_locale is null or p_locale not in ('gu-IN','hi-IN','en-IN') then raise insufficient_privilege; end if;
 select * into strict c from public.agent_support_cases where id=p_case and customer_id=auth.uid() for update;
 if c.status='Resolved' then return; end if;
 select locale into strict previous from public.voice_deployments where id=c.deployment_id and operator_user_id=auth.uid() and enabled for update;
 update public.voice_deployments set locale=p_locale,updated_at=now() where id=c.deployment_id;
 insert into public.agent_support_replies(id,case_id,body) values(gen_random_uuid(),p_case,'Customer approved agent language setting: '||previous||' → '||p_locale||'. Open the agent again to test it. Its scripted greeting and reply retain their original text.');
 update public.agent_support_cases set status='Resolved' where id=p_case;
end $$;
revoke all on function public.support_set_agent_language(uuid,text) from public,anon; grant execute on function public.support_set_agent_language(uuid,text) to authenticated;