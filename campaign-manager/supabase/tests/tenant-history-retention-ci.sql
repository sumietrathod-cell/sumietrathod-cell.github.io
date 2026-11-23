-- Disposable CI PostgreSQL test: opt-out/consent and campaign history must
-- not disappear because an authorized owner deletes a parent record.
-- Entirely fictional tenant data; this transaction rolls back.
BEGIN;

INSERT INTO public.organizations(id,name) VALUES
 ('31000000-0000-4000-8000-000000000001','Synthetic retention organization');
INSERT INTO public.organization_members(organization_id,user_id,role) VALUES
 ('31000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000001','owner');
INSERT INTO public.contacts(id,organization_id,full_name,phone_e164) VALUES
 ('32000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000001','No history','+919999000301'),
 ('32000000-0000-4000-8000-000000000002','31000000-0000-4000-8000-000000000001','Opted-out person','+919999000302'),
 ('32000000-0000-4000-8000-000000000003','31000000-0000-4000-8000-000000000001','Enrolled person','+919999000303');
INSERT INTO public.contact_channel_permissions(
 organization_id,contact_id,channel,permission_status,evidence_reference
) VALUES (
 '31000000-0000-4000-8000-000000000001',
 '32000000-0000-4000-8000-000000000002',
 'whatsapp','withdrawn','synthetic-do-not-contact'
);
INSERT INTO public.campaigns(id,organization_id,name,goal,channel,status,dry_run) VALUES
 ('33000000-0000-4000-8000-000000000001',
  '31000000-0000-4000-8000-000000000001','Empty draft','Synthetic','manual','draft',true),
 ('33000000-0000-4000-8000-000000000002',
  '31000000-0000-4000-8000-000000000001','Draft with enrollment','Synthetic','manual','draft',true);
INSERT INTO public.campaign_contacts(
 organization_id,campaign_id,contact_id,status
) VALUES (
 '31000000-0000-4000-8000-000000000001',
 '33000000-0000-4000-8000-000000000002',
 '32000000-0000-4000-8000-000000000003','queued'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',true);

DO $verify$
DECLARE
 denied boolean;
 rows_changed integer;
BEGIN
  -- Existing cleanup still works where no evidence or enrollment exists.
  DELETE FROM public.contacts WHERE id='32000000-0000-4000-8000-000000000001';
  GET DIAGNOSTICS rows_changed=ROW_COUNT;
  IF rows_changed <> 1 THEN RAISE EXCEPTION 'FAIL: unlinked contact cleanup blocked'; END IF;

  denied:=false;
  BEGIN
    DELETE FROM public.contacts WHERE id='32000000-0000-4000-8000-000000000002';
  EXCEPTION WHEN foreign_key_violation THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'FAIL: owner erased opt-out record through parent contact'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.contact_channel_permissions
    WHERE contact_id='32000000-0000-4000-8000-000000000002'
      AND permission_status='withdrawn'
  ) THEN RAISE EXCEPTION 'FAIL: opt-out evidence lost'; END IF;

  denied:=false;
  BEGIN
    DELETE FROM public.contacts WHERE id='32000000-0000-4000-8000-000000000003';
  EXCEPTION WHEN foreign_key_violation THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'FAIL: owner erased enrolled contact'; END IF;

  DELETE FROM public.campaigns WHERE id='33000000-0000-4000-8000-000000000001';
  GET DIAGNOSTICS rows_changed=ROW_COUNT;
  IF rows_changed <> 1 THEN RAISE EXCEPTION 'FAIL: empty draft cleanup blocked'; END IF;

  denied:=false;
  BEGIN
    DELETE FROM public.campaigns WHERE id='33000000-0000-4000-8000-000000000002';
  EXCEPTION WHEN foreign_key_violation THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'FAIL: owner erased campaign enrollment history'; END IF;

  IF (SELECT count(*) FROM public.campaign_contacts
       WHERE campaign_id='33000000-0000-4000-8000-000000000002') <> 1
  THEN RAISE EXCEPTION 'FAIL: campaign enrollment unexpectedly lost'; END IF;

  RAISE NOTICE 'PASS: owner cannot cascade-delete consent, opt-out, or enrolled campaign history';
END
$verify$;
RESET ROLE;
SELECT 'PASS: linked evidence/history preserved by FK RESTRICT, rolled back' AS verdict;
ROLLBACK;
