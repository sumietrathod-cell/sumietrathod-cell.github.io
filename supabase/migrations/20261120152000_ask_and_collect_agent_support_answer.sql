alter table public.agent_support_replies add column automated boolean not null default false;
alter table public.agent_support_cases add column awaiting_intake_answer boolean not null default false;
create function public.ask_agent_support_question() returns trigger
language plpgsql security definer set search_path='' as $$
declare question text;
begin
 question := case split_part(new.issue,' · ',1)
 when 'Language' then 'Does this happen in the greeting, in later replies, or both? Please name the language you want.'
 when 'Reply' then 'What exact words did your agent use, and which approved product detail or price should it use instead?'
 when 'Website' then 'Which device and browser are you using? Does the agent fail to open, start listening, or play a reply?'
 else 'What steps can we follow to reproduce the issue, and does it happen every time?' end;
 update public.agent_support_cases set awaiting_intake_answer=true,status='Waiting for customer' where id=new.id;
 insert into public.agent_support_replies(id,case_id,author_id,body,automated) values(gen_random_uuid(),new.id,new.customer_id,question,true);
 return new;
end $$;
create trigger ask_agent_support_question after insert on public.agent_support_cases for each row execute function public.ask_agent_support_question();
create function public.receive_agent_support_answer() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.automated then return new; end if;
 update public.agent_support_cases set awaiting_intake_answer=false,status='Open' where id=new.case_id and customer_id=new.author_id and awaiting_intake_answer and status='Waiting for customer' and auth.uid()=new.author_id and pg_trigger_depth()=1;
 if found then
 insert into public.agent_support_replies(id,case_id,author_id,body,automated) values(gen_random_uuid(),new.case_id,new.author_id,'Your reply is saved with this ticket for support review.',true);
 end if;
 return new;
end $$;
create trigger receive_agent_support_answer after insert on public.agent_support_replies for each row execute function public.receive_agent_support_answer();
revoke all on function public.ask_agent_support_question(),public.receive_agent_support_answer() from public,anon,authenticated;