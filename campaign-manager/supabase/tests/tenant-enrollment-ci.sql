-- Disposable PostgreSQL CI test: client enrollment can ONLY create queued
-- rows in their own draft campaigns; cannot forge outcomes or remove history.
-- No contact is real. This transaction always rolls back.
BEGIN;
INSERT INTO public.organizations(id,name) VALUES
 ('11000000-0000-4000-8000-000000000001','Synthetic operator enrollment org'),
 ('11000000-0000-4000-8000-000000000002','Synthetic foreign enrollment org');
INSERT INTO public.organization_members(organization_id,user_id,role) VALUES
 ('11000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000001','operator');
INSERT INTO public.campaigns(id,organization_id,name,goal,channel,status,dry_run) VALUES
 ('12000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000001','Draft','CI','manual','draft',true),
 ('12000000-0000-4000-8000-000000000002','11000000-0000-4000-8000-000000000001','Running','CI','whatsapp','running',false),
 ('12000000-0000-4000-8000-000000000003','11000000-0000-4000-8000-000000000002','Foreign','CI','manual','draft',true);
INSERT INTO public.contacts(id,organization_id,full_name) VALUES
 ('13000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000001','Synthetic own'),
 ('13000000-0000-4000-8000-000000000002','11000000-0000-4000-8000-000000000002','Synthetic foreign');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',true);

INSERT INTO public.campaign_contacts(id,organization_id,campaign_id,contact_id,status)
VALUES (
 '14000000-0000-4000-8000-000000000001',
 '11000000-0000-4000-8000-000000000001',
 '12000000-0000-4000-8000-000000000001',
 '13000000-0000-4000-8000-000000000001','queued'
);

DO $verify$
DECLARE
 denied boolean;
 changed integer;
BEGIN
 IF (SELECT count(*) FROM public.campaign_contacts) <> 1 THEN
  RAISE EXCEPTION 'FAIL: operator cannot read own enrollment';
 END IF;

 denied:=false;
 BEGIN
  INSERT INTO public.campaign_contacts(organization_id,campaign_id,contact_id,status)
  VALUES('11000000-0000-4000-8000-000000000001',
   '12000000-0000-4000-8000-000000000001',
   '13000000-0000-4000-8000-000000000001','reached');
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL: client forged reached outcome'; END IF;

 denied:=false;
 BEGIN
  INSERT INTO public.campaign_contacts(organization_id,campaign_id,contact_id,status,attempts)
  VALUES('11000000-0000-4000-8000-000000000001',
   '12000000-0000-4000-8000-000000000001',
   '13000000-0000-4000-8000-000000000001','queued',3);
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL: client forged attempt count'; END IF;

 denied:=false;
 BEGIN
  INSERT INTO public.campaign_contacts(organization_id,campaign_id,contact_id,status)
  VALUES('11000000-0000-4000-8000-000000000001',
   '12000000-0000-4000-8000-000000000002',
   '13000000-0000-4000-8000-000000000001','queued');
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL: direct enrollment in live campaign'; END IF;

 denied:=false;
 BEGIN
  INSERT INTO public.campaign_contacts(organization_id,campaign_id,contact_id,status)
  VALUES('11000000-0000-4000-8000-000000000002',
   '12000000-0000-4000-8000-000000000003',
   '13000000-0000-4000-8000-000000000002','queued');
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL: cross-tenant enrollment allowed'; END IF;

 UPDATE public.campaign_contacts SET status='reached',attempts=99
 WHERE id='14000000-0000-4000-8000-000000000001';
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>0 THEN RAISE EXCEPTION 'FAIL: client updated outcome/attempts'; END IF;

 DELETE FROM public.campaign_contacts
 WHERE id='14000000-0000-4000-8000-000000000001';
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>0 THEN RAISE EXCEPTION 'FAIL: client erased campaign enrollment'; END IF;

 IF NOT EXISTS (
  SELECT 1 FROM public.campaign_contacts
  WHERE id='14000000-0000-4000-8000-000000000001' AND status='queued' AND attempts=0
 ) THEN RAISE EXCEPTION 'FAIL: original queued enrollment corrupted'; END IF;
 RAISE NOTICE 'PASS: draft-only queued insert, blocked status/attempt forging, blocked updates/deletes and cross-tenant insertion';
END
$verify$;
RESET ROLE;
SELECT 'PASS: authenticated enrollment stays immutable; rolled back' AS verdict;
ROLLBACK;
