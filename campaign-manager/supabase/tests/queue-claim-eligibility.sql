-- Staging simulation: exact queue-claim source, rewritten ONLY to synthetic
-- PG temporary table/function names, and all changes rolled back.
-- No provider dispatch, live data mutation, or customer contact occurs.
BEGIN;
CREATE TEMP TABLE synthetic_jobs (
 id uuid primary key, organization_id uuid not null,
 campaign_contact_id uuid not null, idempotency_key text not null,
 status text not null, available_at timestamptz not null,
 created_at timestamptz not null, updated_at timestamptz not null default now(),
 attempts integer not null default 0, locked_at timestamptz, locked_by text,
 case_name text not null
);
CREATE TEMP TABLE synthetic_campaigns (
 id uuid primary key, organization_id uuid not null, status text not null,
 dry_run boolean not null, channel text not null, timezone text not null,
 calling_window_start time, calling_window_end time,
 max_attempts integer not null
);
CREATE TEMP TABLE synthetic_campaign_contacts (
 id uuid primary key, organization_id uuid not null, campaign_id uuid not null,
 contact_id uuid not null, status text not null, attempts integer not null default 0
);
CREATE TEMP TABLE synthetic_contacts (
 id uuid primary key, organization_id uuid not null, phone_e164 text
);
CREATE TEMP TABLE synthetic_permissions (
 organization_id uuid not null, contact_id uuid not null, channel text not null,
 permission_status text not null, evidence_reference text,
 captured_at timestamptz, captured_by uuid
);
CREATE TEMP TABLE synthetic_suppressions (
 organization_id uuid not null, contact_id uuid,
 phone_e164 text, channel text
);

create or replace function pg_temp.claim_due_campaign_jobs_test(
  requested_batch_size integer,
  worker_name text
)
returns table (
  job_id uuid,
  organization_id uuid,
  campaign_contact_id uuid,
  idempotency_key text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if requested_batch_size is null or requested_batch_size < 1 or requested_batch_size > 100 then
    raise exception 'requested_batch_size must be between 1 and 100';
  end if;
  if worker_name is null or length(trim(worker_name)) < 1 or length(worker_name) > 120 then
    raise exception 'worker_name is required (max 120 chars)';
  end if;

  return query
  with candidates as (
    select j.id
    from pg_temp.synthetic_jobs as j
    join pg_temp.synthetic_campaign_contacts as cc
      on cc.id = j.campaign_contact_id
     and cc.organization_id = j.organization_id
    join pg_temp.synthetic_campaigns as c
      on c.id = cc.campaign_id
     and c.organization_id = j.organization_id
    join pg_temp.synthetic_contacts as ct
      on ct.id = cc.contact_id
     and ct.organization_id = j.organization_id
    where j.status = 'queued'
      and j.available_at <= now()
      and c.status = 'running'
      and c.dry_run = false
      and c.channel in ('voice', 'whatsapp')
      and cc.status in ('queued', 'callback', 'no_answer')
      and cc.attempts < c.max_attempts
      and j.attempts < c.max_attempts
      and ct.phone_e164 ~ '^\+[1-9][0-9]{7,14}$'
      and exists (
        select 1
        from pg_temp.synthetic_permissions as p
        where p.organization_id = j.organization_id
          and p.contact_id = ct.id
          and p.channel = c.channel
          and p.permission_status = 'granted'
          and nullif(trim(p.evidence_reference), '') is not null
          and p.captured_at is not null
          and p.captured_at <= now()
          and p.captured_by is not null
      )
      and not exists (
        select 1
        from pg_temp.synthetic_suppressions as s
        where s.organization_id = j.organization_id
          and (s.contact_id = ct.id or s.phone_e164 = ct.phone_e164)
          and (s.channel is null or s.channel = c.channel)
      )
      -- Fail closed: never interpret an absent time window as 24/7 permission.
      -- Only an explicitly configured non-overnight local window is eligible.
      -- Regulatory quiet hours and recipient-specific time zones still require
      -- independent validation by the future provider worker before any send.
      and c.calling_window_start is not null
      and c.calling_window_end is not null
      and c.calling_window_start < c.calling_window_end
      and (now() at time zone c.timezone)::time >= c.calling_window_start
      and (now() at time zone c.timezone)::time < c.calling_window_end
    order by j.available_at, j.created_at
    limit requested_batch_size
    for update of j skip locked
  ),
  claimed as (
    update pg_temp.synthetic_jobs as j
       set status = 'processing',
           locked_at = now(),
           locked_by = worker_name,
           attempts = j.attempts + 1,
           updated_at = now()
      from candidates as candidate
     where j.id = candidate.id
    returning j.id, j.organization_id, j.campaign_contact_id, j.idempotency_key
  )
  select claimed.id, claimed.organization_id, claimed.campaign_contact_id, claimed.idempotency_key
  from claimed;
end;
$$;

DO $test$
DECLARE
  k integer;
  org_id uuid := gen_random_uuid();
  camp_id uuid;
  enrollment_id uuid;
  contact_id uuid;
  job_id uuid;
  count_claimed integer;
  case_names text[] := array[
    'eligible',
    'missing_window',
    'missing_actor',
    'future_evidence',
    'withdrawn',
    'suppressed',
    'equal_window',
    'attempt_cap',
    'empty_evidence',
    'missing_captured_at',
    'missing_permission'
  ];
BEGIN
  FOR k IN 1..array_length(case_names,1) LOOP
    camp_id := gen_random_uuid();
    enrollment_id := gen_random_uuid();
    contact_id := gen_random_uuid();
    job_id := gen_random_uuid();
    INSERT INTO pg_temp.synthetic_campaigns(
      id, organization_id, status, dry_run, channel, timezone,
      calling_window_start, calling_window_end, max_attempts
    ) VALUES(
      camp_id,org_id,'running',false,'whatsapp','Asia/Kolkata',
      CASE WHEN k=2 THEN NULL ELSE time '00:00' END,
      CASE WHEN k=2 THEN NULL WHEN k=7 THEN time '00:00' ELSE time '23:59' END,
      3
    );
    INSERT INTO pg_temp.synthetic_contacts(id, organization_id, phone_e164)
      VALUES(contact_id, org_id, '+919876543210');
    INSERT INTO pg_temp.synthetic_campaign_contacts(
      id, organization_id, campaign_id, contact_id, status, attempts
    ) VALUES(enrollment_id,org_id,camp_id,contact_id,'queued',0);
    INSERT INTO pg_temp.synthetic_jobs(
      id,organization_id,campaign_contact_id,idempotency_key,status,
      available_at,created_at,attempts,case_name
    ) VALUES(job_id,org_id,enrollment_id,'synthetic-'||k,'queued',
      now()-interval '1 minute',now()-interval '2 minutes',
      CASE WHEN k=8 THEN 3 ELSE 0 END,case_names[k]);
    IF k<>11 THEN
      INSERT INTO pg_temp.synthetic_permissions(
        organization_id,contact_id,channel,permission_status,evidence_reference,
        captured_at,captured_by
      ) VALUES(
        org_id,contact_id,'whatsapp',
        CASE WHEN k=5 THEN 'withdrawn' ELSE 'granted' END,
        CASE WHEN k=9 THEN '  ' ELSE 'synthetic-evidence-only' END,
        CASE WHEN k=4 THEN now()+interval '1 day'
             WHEN k=10 THEN NULL ELSE now()-interval '1 day' END,
        CASE WHEN k=3 THEN NULL ELSE gen_random_uuid() END
      );
    END IF;
    IF k=6 THEN
      INSERT INTO pg_temp.synthetic_suppressions(organization_id,contact_id,phone_e164,channel)
        VALUES(org_id,contact_id,'+919876543210','whatsapp');
    END IF;
  END LOOP;

  SELECT count(*) INTO count_claimed
  FROM pg_temp.claim_due_campaign_jobs_test(100,'synthetic-test-worker');
  IF count_claimed <> 1 THEN
    RAISE EXCEPTION 'FAIL: expected one eligible queue claim, got %',count_claimed;
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM pg_temp.synthetic_jobs
    WHERE case_name='eligible' AND status='processing'
      AND attempts=1 AND locked_by='synthetic-test-worker'
  ) THEN
    RAISE EXCEPTION 'FAIL: valid consent and window did not claim';
  END IF;
  IF EXISTS(
    SELECT 1 FROM pg_temp.synthetic_jobs
    WHERE case_name<>'eligible' AND (status<>'queued' OR locked_at IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'FAIL: forbidden job claimed';
  END IF;
  SELECT count(*) INTO count_claimed
  FROM pg_temp.claim_due_campaign_jobs_test(100,'synthetic-test-worker');
  IF count_claimed <> 0 THEN
    RAISE EXCEPTION 'FAIL: repeat claim processed in-progress job again';
  END IF;
  RAISE NOTICE 'PASS: explicit window, consent proof, suppression and attempts verified';
END $test$;
SELECT 'PASS: 11 temporary jobs, 1 eligible, no contacts sent, rollback' AS verdict;
ROLLBACK;
