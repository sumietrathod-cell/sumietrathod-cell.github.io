do $migration$
declare previous text; revised text;
begin
 select pg_get_functiondef('public.support_set_agent_language(uuid,text)'::regprocedure) into previous;
 revised:=replace(previous,'agent_support_replies(id,case_id,body) values(gen_random_uuid(),p_case,','agent_support_replies(id,case_id,automated,body) values(gen_random_uuid(),p_case,true,');
 if revised=previous then raise exception 'Unexpected repair signature'; end if;
 execute replace(revised,'set status=''Resolved''','set awaiting_intake_answer=false,status=''Resolved''');
end $migration$;