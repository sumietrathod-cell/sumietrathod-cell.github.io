-- Disposable CI PostgreSQL test of contact/consent identity invariants.
-- Synthetic contact details only. No real users, phone calls or messages.
BEGIN;

INSERT INTO public.organizations(id,name) VALUES
 ('21000000-0000-4000-8000-000000000001','Synthetic consent owner'),
 ('21000000-0000-4000-8000-000000000002','Synthetic foreign tenant');
INSERT INTO public.organization_members(organization_id,user_id,role) VALUES
 ('21000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000001','operator');
INSERT INTO public.contacts(id,organization_id,phone_e164,full_name) VALUES
 ('22000000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000001','+919999000101','Safe to edit'),
 ('22000000-0000-4000-8000-000000000002','21000000-0000-4000-8000-000000000001','+919999000102','Consent already captured'),
 ('22000000-0000-4000-8000-000000000003','21000000-0000-4000-8000-000000000001','+919999000103','Campaign enrollment'),
 ('22000000-0000-4000-8000-000000000004','21000000-0000-4000-8000-000000000002','+919999000104','Foreign contact');

INSERT INTO public.contact_channel_permissions(
 id,organization_id,contact_id,channel,permission_status,evidence_reference,captured_at,captured_by
) VALUES (
 '23000000-0000-4000-8000-000000000001',
 '21000000-0000-4000-8000-000000000001',
 '22000000-0000-4000-8000-000000000002',
 'whatsapp','granted','fictional-ci-evidence',now(),
 '00000000-0000-0000-0000-000000000001'
);
INSERT INTO public.campaigns(
 id,organization_id,name,goal,channel,status,dry_run
) VALUES (
 '24000000-0000-4000-8000-000000000001',
 '21000000-0000-4000-8000-000000000001',
 'Fictional draft','CI identity test','manual','draft',true
);
INSERT INTO public.campaign_contacts(
 id,organization_id,campaign_id,contact_id,status
) VALUES (
 '25000000-0000-4000-8000-000000000001',
 '21000000-0000-4000-8000-000000000001',
 '24000000-0000-4000-8000-000000000001',
 '22000000-0000-4000-8000-000000000003','queued'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',true);

DO $checks$
DECLARE rejected boolean;
DECLARE touched integer;
BEGIN
  UPDATE public.contacts SET phone_e164='+919999000201'
  WHERE id='22000000-0000-4000-8000-000000000001';
  IF (SELECT phone_e164 FROM public.contacts
    WHERE id='22000000-0000-4000-8000-000000000001') <> '+919999000201'
    THEN RAISE EXCEPTION 'FAIL: new contact phone could not be corrected before consent'; END IF;

  UPDATE public.contacts SET full_name='Updated name with same phone'
  WHERE id='22000000-0000-4000-8000-000000000002';
  IF (SELECT full_name FROM public.contacts
    WHERE id='22000000-0000-4000-8000-000000000002') <> 'Updated name with same phone'
    THEN RAISE EXCEPTION 'FAIL: normal name edit rejected'; END IF;

  rejected:=false;
  BEGIN
    UPDATE public.contacts SET phone_e164='+919999000202'
    WHERE id='22000000-0000-4000-8000-000000000002';
  EXCEPTION WHEN check_violation THEN rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'FAIL: consent transferred to different phone'; END IF;

  rejected:=false;
  BEGIN
    UPDATE public.contacts SET phone_e164=NULL
    WHERE id='22000000-0000-4000-8000-000000000003';
  EXCEPTION WHEN check_violation THEN rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'FAIL: enrolled contact phone could be replaced or cleared'; END IF;

  rejected:=false;
  BEGIN
    UPDATE public.contacts SET organization_id='21000000-0000-4000-8000-000000000002'
    WHERE id='22000000-0000-4000-8000-000000000001';
  EXCEPTION WHEN check_violation THEN rejected:=true;
       WHEN insufficient_privilege THEN rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'FAIL: contact tenant moved'; END IF;

  rejected:=false;
  BEGIN
    UPDATE public.contacts SET id='22000000-0000-4000-8000-000000000009'
    WHERE id='22000000-0000-4000-8000-000000000001';
  EXCEPTION WHEN check_violation THEN rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'FAIL: contact ID mutated'; END IF;

  UPDATE public.contacts SET phone_e164='+919999000999'
  WHERE id='22000000-0000-4000-8000-000000000004';
  GET DIAGNOSTICS touched=ROW_COUNT;
  IF touched<>0 THEN RAISE EXCEPTION 'FAIL: foreign tenant phone changed'; END IF;

  IF (SELECT phone_e164 FROM public.contacts
    WHERE id='22000000-0000-4000-8000-000000000002') <> '+919999000102'
    OR (SELECT phone_e164 FROM public.contacts
    WHERE id='22000000-0000-4000-8000-000000000003') <> '+919999000103'
    THEN RAISE EXCEPTION 'FAIL: protected phone mutated'; END IF;
  RAISE NOTICE 'PASS: fresh contact edit, immutable tenant/id, and consent/enrollment phone lock';
END $checks$;
RESET ROLE;
SELECT 'PASS: real PostgreSQL blocks consent-phone reassignment; rolled back' AS verdict;
ROLLBACK;
