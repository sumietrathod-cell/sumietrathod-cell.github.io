-- Staging-only synthetic test. Runs entirely in a temporary table and rolls back.
-- Actual source function must be identical after schema/name substitution.
BEGIN;
CREATE TEMP TABLE synthetic_campaign_jobs(
 id uuid primary key, status text not null, locked_at timestamptz,
 locked_by text, last_error_code text, updated_at timestamptz default now(),
 attempts integer default 1
);
INSERT INTO synthetic_campaign_jobs(id,status,locked_at,locked_by,attempts) VALUES
 ('00000000-0000-4000-8000-000000000201','processing',now()-interval '120 minutes','crashed-worker',1),
 ('00000000-0000-4000-8000-000000000202','processing',now()-interval '90 minutes','crashed-worker',2),
 ('00000000-0000-4000-8000-000000000203','processing',now()-interval '5 minutes','healthy-worker',1),
 ('00000000-0000-4000-8000-000000000204','queued',now()-interval '200 minutes',null,0),
 ('00000000-0000-4000-8000-000000000205','processing',null,'no-lock',1),
 ('00000000-0000-4000-8000-000000000206','completed',now()-interval '300 minutes',null,1);

create or replace function pg_temp.quarantine_stale_campaign_jobs_test(
  p_stale_after_minutes integer default 30,
  p_batch_size integer default 100
)
returns integer
language plpgsql
security definer
set search_path = ''
as $quarantine$
declare
  affected integer := 0;
begin
  if p_stale_after_minutes is null or p_stale_after_minutes < 15
      or p_stale_after_minutes > 1440 then
    raise exception 'stale interval must be between 15 and 1440 minutes';
  end if;
  if p_batch_size is null or p_batch_size < 1 or p_batch_size > 100 then
    raise exception 'batch size must be between 1 and 100';
  end if;
  with candidates as (
    select j.id
    from pg_temp.synthetic_campaign_jobs j
    where j.status = 'processing'
      and j.locked_at is not null
      and j.locked_at <= now() - make_interval(mins => p_stale_after_minutes)
    order by j.locked_at, j.id
    limit p_batch_size
    for update of j skip locked
  ), quarantined as (
    update pg_temp.synthetic_campaign_jobs j
       set status = 'failed',
           locked_at = null,
           locked_by = null,
           last_error_code = 'stale_claim_needs_manual_review',
           updated_at = now()
      from candidates c
     where j.id = c.id and j.status = 'processing'
    returning j.id
  )
  select count(*) into affected from quarantined;
  return affected;
end;
$quarantine$;

DO $checks$
DECLARE
 n integer;
 invalid_rejected boolean;
BEGIN
 n:=pg_temp.quarantine_stale_campaign_jobs_test(30,1);
 IF n <> 1 THEN RAISE EXCEPTION 'FAIL: expected one quarantined claim'; END IF;
 n:=pg_temp.quarantine_stale_campaign_jobs_test(30,100);
 IF n <> 1 THEN RAISE EXCEPTION 'FAIL: expected second stale claim'; END IF;
 n:=pg_temp.quarantine_stale_campaign_jobs_test(30,100);
 IF n <> 0 THEN RAISE EXCEPTION 'FAIL: repeated run is not idempotent'; END IF;
 IF (SELECT count(*) FROM pg_temp.synthetic_campaign_jobs WHERE status='failed')<>2 THEN
  RAISE EXCEPTION 'FAIL: incorrect failed count'; END IF;
 IF (SELECT count(*) FROM pg_temp.synthetic_campaign_jobs WHERE status='processing')<>2 THEN
  RAISE EXCEPTION 'FAIL: healthy or unclaimed job was changed'; END IF;
 IF (SELECT count(*) FROM pg_temp.synthetic_campaign_jobs WHERE status='queued')<>1 THEN
  RAISE EXCEPTION 'FAIL: queued job was changed'; END IF;
 IF EXISTS (SELECT 1 FROM pg_temp.synthetic_campaign_jobs WHERE status='failed'
             AND (locked_at IS NOT NULL OR locked_by IS NOT NULL OR last_error_code <> 'stale_claim_needs_manual_review')) THEN
  RAISE EXCEPTION 'FAIL: quarantined claim state incorrect'; END IF;
 IF (SELECT attempts FROM pg_temp.synthetic_campaign_jobs WHERE id='00000000-0000-4000-8000-000000000202') <> 2 THEN
  RAISE EXCEPTION 'FAIL: attempt counter altered'; END IF;
 invalid_rejected := false;
 BEGIN
  PERFORM pg_temp.quarantine_stale_campaign_jobs_test(1,10);
 EXCEPTION WHEN raise_exception THEN invalid_rejected := true;
 END;
 IF NOT invalid_rejected THEN RAISE EXCEPTION 'FAIL: unsafe timeout allowed'; END IF;
 invalid_rejected := false;
 BEGIN
  PERFORM pg_temp.quarantine_stale_campaign_jobs_test(30,101);
 EXCEPTION WHEN raise_exception THEN invalid_rejected := true;
 END;
 IF NOT invalid_rejected THEN RAISE EXCEPTION 'FAIL: unbounded batch allowed'; END IF;
 RAISE NOTICE 'PASS: quarantine is bounded, idempotent and does not requeue';
END;
$checks$;
SELECT 'PASS: synthetic stale-claim quarantine; rolled back' AS verdict;
ROLLBACK;
