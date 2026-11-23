-- CI ONLY: actual, isolated PostgreSQL 17 table/index behavior.
-- Synthetic rows, no provider calls, no live Supabase writes. Rollback at end.
BEGIN;
DO $test$
DECLARE
  org_id uuid := gen_random_uuid();
  campaign_id uuid := gen_random_uuid();
  person_id uuid := gen_random_uuid();
  enrollment_id uuid := gen_random_uuid();
  job_a uuid;
  job_b uuid;
  denial boolean;
BEGIN
  INSERT INTO public.organizations(id,name) VALUES(org_id,'Synthetic queue isolation');
  INSERT INTO public.campaigns(id,organization_id,name,goal,channel)
  VALUES(campaign_id,org_id,'CI-only','test','manual');
  INSERT INTO public.contacts(id,organization_id,full_name)
  VALUES(person_id,org_id,'Synthetic queue contact');
  INSERT INTO public.campaign_contacts(id,organization_id,campaign_id,contact_id)
  VALUES(enrollment_id,org_id,campaign_id,person_id);

  INSERT INTO public.campaign_jobs(organization_id,campaign_contact_id,idempotency_key)
  VALUES(org_id,enrollment_id,'ci-duplicate-key-1') RETURNING id INTO job_a;

  denial := false;
  BEGIN
    INSERT INTO public.campaign_jobs(organization_id,campaign_contact_id,idempotency_key)
    VALUES(org_id,enrollment_id,'ci-different-key-2');
  EXCEPTION WHEN unique_violation THEN denial := true;
  END;
  IF NOT denial THEN
    RAISE EXCEPTION 'FAIL: second queued job for same enrollment was allowed';
  END IF;

  UPDATE public.campaign_jobs SET status='processing' WHERE id=job_a;
  denial := false;
  BEGIN
    INSERT INTO public.campaign_jobs(organization_id,campaign_contact_id,idempotency_key)
    VALUES(org_id,enrollment_id,'ci-different-key-3');
  EXCEPTION WHEN unique_violation THEN denial := true;
  END;
  IF NOT denial THEN
    RAISE EXCEPTION 'FAIL: queued job added while first processing';
  END IF;

  UPDATE public.campaign_jobs SET status='completed' WHERE id=job_a;
  INSERT INTO public.campaign_jobs(organization_id,campaign_contact_id,idempotency_key)
  VALUES(org_id,enrollment_id,'ci-new-attempt-after-completion')
  RETURNING id INTO job_b;
  IF job_b = job_a THEN RAISE EXCEPTION 'FAIL: new attempt reused job'; END IF;

  denial := false;
  BEGIN
    UPDATE public.campaign_jobs SET status='processing' WHERE id=job_a;
  EXCEPTION WHEN unique_violation THEN denial := true;
  END;
  IF NOT denial THEN
    RAISE EXCEPTION 'FAIL: concurrent processing state allowed';
  END IF;

  IF (SELECT count(*) FROM public.campaign_jobs
      WHERE campaign_contact_id=enrollment_id AND status in ('queued','processing')) <> 1 THEN
    RAISE EXCEPTION 'FAIL: active queue count not exactly one';
  END IF;
  RAISE NOTICE 'PASS: exactly one active job per contact, regardless of differing idempotency keys';
END
$test$;
SELECT 'PASS: real unique partial index blocks duplicate active jobs; rolled back' AS verdict;
ROLLBACK;
