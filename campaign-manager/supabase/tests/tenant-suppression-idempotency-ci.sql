-- Disposable PostgreSQL 17 CI test for repeated opt-out / CSV withdrawal.
-- Works on synthetic org/contact data only and ALWAYS rolls back.
BEGIN;
INSERT INTO public.organizations(id,name) VALUES
 ('41000000-0000-4000-8000-000000000001','Synthetic opt-out tenant A'),
 ('41000000-0000-4000-8000-000000000002','Synthetic opt-out tenant B');
INSERT INTO public.organization_members(organization_id,user_id,role) VALUES
 ('41000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000001','viewer'),
 ('41000000-0000-4000-8000-000000000002',
  '00000000-0000-0000-0000-000000000002','operator');
INSERT INTO public.contacts(id,organization_id,phone_e164,full_name) VALUES
 ('42000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001','+919999000401','Synthetic optout A'),
 ('42000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000002','+919999000402','Synthetic optout B');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',true);

DO $test$
DECLARE
  first_id uuid;
  denied boolean;
BEGIN
  INSERT INTO public.suppression_list(
    organization_id,contact_id,phone_e164,channel,reason,source)
  VALUES(
    '41000000-0000-4000-8000-000000000001',
    '42000000-0000-4000-8000-000000000001',
    '+919999000401','whatsapp','first_request','campaign_manager_opt_out'
  ) ON CONFLICT (contact_id,channel) DO NOTHING
  RETURNING id INTO first_id;
  IF first_id IS NULL THEN RAISE EXCEPTION 'FAIL: initial opt-out was not inserted'; END IF;

  -- This is equivalent to PostgREST upsert with ignoreDuplicates=true.
  -- A second request must succeed without erasing the original source/reason.
  INSERT INTO public.suppression_list(
    organization_id,contact_id,phone_e164,channel,reason,source)
  VALUES(
    '41000000-0000-4000-8000-000000000001',
    '42000000-0000-4000-8000-000000000001',
    '+919999000401','whatsapp','retry_request','campaign_manager_opt_out'
  ) ON CONFLICT (contact_id,channel) DO NOTHING;
  IF (SELECT count(*) FROM public.suppression_list
      WHERE contact_id='42000000-0000-4000-8000-000000000001'
        AND channel='whatsapp')<>1 THEN
    RAISE EXCEPTION 'FAIL: repeated opt-out created duplicate suppression';
  END IF;
  IF (SELECT reason FROM public.suppression_list WHERE id=first_id)<>'first_request' THEN
    RAISE EXCEPTION 'FAIL: repeated opt-out overwrote original evidence';
  END IF;

  denied:=false;
  BEGIN
    INSERT INTO public.suppression_list(
      organization_id,contact_id,phone_e164,channel,reason,source)
    VALUES(
      '41000000-0000-4000-8000-000000000001',
      '42000000-0000-4000-8000-000000000001',
      '+919999000401','whatsapp','duplicate_without_conflict_handling','campaign_manager_opt_out');
  EXCEPTION WHEN unique_violation THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'FAIL: database uniqueness guard was bypassed'; END IF;

  -- Different channel is deliberately a distinct suppression.
  INSERT INTO public.suppression_list(
    organization_id,contact_id,phone_e164,channel,reason,source)
  VALUES (
    '41000000-0000-4000-8000-000000000001',
    '42000000-0000-4000-8000-000000000001',
    '+919999000401','voice','channel_specific','campaign_manager_opt_out'
  ) ON CONFLICT (contact_id,channel) DO NOTHING;
  IF (SELECT count(*) FROM public.suppression_list
      WHERE contact_id='42000000-0000-4000-8000-000000000001')<>2 THEN
    RAISE EXCEPTION 'FAIL: distinct voice suppression was not created';
  END IF;

  -- The viewer cannot use the CSV import operator-only policy.
  denied:=false;
  BEGIN
    INSERT INTO public.suppression_list(
      organization_id,contact_id,phone_e164,channel,reason,source)
    VALUES(
      '41000000-0000-4000-8000-000000000001',
      '42000000-0000-4000-8000-000000000001',
      '+919999000401','email','csv_withdrawal','csv_import');
  EXCEPTION WHEN insufficient_privilege THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'FAIL: viewer gained operator-only CSV write'; END IF;

  denied:=false;
  BEGIN
    INSERT INTO public.suppression_list(
      organization_id,contact_id,phone_e164,channel,reason,source)
    VALUES(
      '41000000-0000-4000-8000-000000000002',
      '42000000-0000-4000-8000-000000000002',
      '+919999000402','whatsapp','cross_tenant','campaign_manager_opt_out');
  EXCEPTION WHEN insufficient_privilege THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'FAIL: foreign tenant suppression allowed'; END IF;
END
$test$;

SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}',true);

DO $test_b$
DECLARE
 row_id uuid;
BEGIN
  INSERT INTO public.suppression_list(
    organization_id,contact_id,phone_e164,channel,reason,source)
  VALUES(
    '41000000-0000-4000-8000-000000000002',
    '42000000-0000-4000-8000-000000000002',
    '+919999000402','whatsapp','csv_withdrawal','csv_import'
  ) ON CONFLICT (contact_id,channel) DO NOTHING
  RETURNING id INTO row_id;
  IF row_id IS NULL THEN RAISE EXCEPTION 'FAIL: operator withdrawal blocked'; END IF;

  INSERT INTO public.suppression_list(
    organization_id,contact_id,phone_e164,channel,reason,source)
  VALUES(
    '41000000-0000-4000-8000-000000000002',
    '42000000-0000-4000-8000-000000000002',
    '+919999000402','whatsapp','retry_import','csv_import'
  ) ON CONFLICT (contact_id,channel) DO NOTHING;

  IF (SELECT count(*) FROM public.suppression_list
      WHERE contact_id='42000000-0000-4000-8000-000000000002'
        AND channel='whatsapp')<>1 THEN
    RAISE EXCEPTION 'FAIL: repeat CSV withdrawal duplicated suppression';
  END IF;
  IF (SELECT reason FROM public.suppression_list WHERE id=row_id)<>'csv_withdrawal' THEN
    RAISE EXCEPTION 'FAIL: CSV retry overwrote original suppression reason';
  END IF;
END $test_b$;
RESET ROLE;
SELECT 'PASS: idempotent opt-out and CSV withdrawal, tenant RLS and prior reason preservation' AS verdict;
ROLLBACK;
