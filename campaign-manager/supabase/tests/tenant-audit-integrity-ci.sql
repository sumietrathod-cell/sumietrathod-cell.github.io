-- Disposable two-tenant PostgreSQL test: authenticated audit inserts must be
-- tied to actual suppressed and withdrawn contacts in the same organization.
-- All fixtures are fictional. This transaction ALWAYS rolls back.
BEGIN;
INSERT INTO public.organizations(id,name) VALUES
 ('61000000-0000-4000-8000-000000000001','Synthetic audit org Alpha'),
 ('61000000-0000-4000-8000-000000000002','Synthetic audit org Beta');
INSERT INTO public.organization_members(organization_id,user_id,role) VALUES
 ('61000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000001','operator'),
 ('61000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000002','viewer');
INSERT INTO public.contacts(id,organization_id,phone_e164) VALUES
 ('62000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001','+919999000601'),
 ('62000000-0000-4000-8000-000000000002','61000000-0000-4000-8000-000000000001','+919999000602'),
 ('62000000-0000-4000-8000-000000000003','61000000-0000-4000-8000-000000000002','+919999000603');
INSERT INTO public.contact_channel_permissions(
 organization_id,contact_id,channel,permission_status
) VALUES
 ('61000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001','whatsapp','withdrawn'),
 ('61000000-0000-4000-8000-000000000002','62000000-0000-4000-8000-000000000003','voice','withdrawn');
INSERT INTO public.suppression_list(
 organization_id,contact_id,phone_e164,channel,reason,source
) VALUES
 ('61000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001','+919999000601','whatsapp','opted_out','campaign_manager_opt_out'),
 ('61000000-0000-4000-8000-000000000002','62000000-0000-4000-8000-000000000003','+919999000603','voice','opted_out','campaign_manager_opt_out');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',true);

DO $check_alpha$
DECLARE denied boolean;
DECLARE count_before integer;
DECLARE audit_id bigint;
BEGIN
  INSERT INTO public.audit_events(
    organization_id,actor_user_id,event_type,entity_type,entity_id,details
  ) VALUES (
    '61000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'contact_permission_withdrawn','contact',
    '62000000-0000-4000-8000-000000000001',
    '{"channel":"whatsapp","source":"campaign_manager_opt_out"}'
  ) RETURNING id INTO audit_id;
  IF audit_id IS NULL THEN
    RAISE EXCEPTION 'FAIL: real opt-out audit event was blocked';
  END IF;

  FOR count_before IN 1..8 LOOP
    denied := false;
    BEGIN
      INSERT INTO public.audit_events(
        organization_id,actor_user_id,event_type,entity_type,entity_id,details
      ) VALUES (
        CASE WHEN count_before=8
          THEN '61000000-0000-4000-8000-000000000002'::uuid
          ELSE '61000000-0000-4000-8000-000000000001'::uuid END,
        CASE WHEN count_before=1
          THEN '00000000-0000-0000-0000-000000000002'::uuid
          ELSE '00000000-0000-0000-0000-000000000001'::uuid END,
        CASE WHEN count_before=2 THEN 'outreach_completed'
          ELSE 'contact_permission_withdrawn' END,
        CASE WHEN count_before=3 THEN 'campaign'
          ELSE 'contact' END,
        CASE WHEN count_before=4
          THEN '62000000-0000-4000-8000-000000000002'::uuid
          WHEN count_before=8
          THEN '62000000-0000-4000-8000-000000000003'::uuid
          ELSE '62000000-0000-4000-8000-000000000001'::uuid END,
        CASE WHEN count_before=5
          THEN '{"channel":"voice","source":"campaign_manager_opt_out"}'::jsonb
          WHEN count_before=6
          THEN '{"channel":"whatsapp","source":"manual"}'::jsonb
          WHEN count_before=7
          THEN '{"channel":"whatsapp","source":"campaign_manager_opt_out","forged":true}'::jsonb
          ELSE '{"channel":"whatsapp","source":"campaign_manager_opt_out"}'::jsonb END
      );
    EXCEPTION WHEN insufficient_privilege THEN denied:=true;
    END;
    IF NOT denied THEN
      RAISE EXCEPTION 'FAIL: forged audit insert was accepted, case %',count_before;
    END IF;
  END LOOP;
  -- Client role has no audit SELECT policy (by design). Validate stored
  -- counts after RESET ROLE, not through an operator who cannot read logs.
  RAISE NOTICE 'PASS: eight invalid opt-out audit claims rejected by RLS';
END
$check_alpha$;

SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}',true);

DO $check_beta$
DECLARE denied boolean := false;
DECLARE audit_id bigint;
BEGIN
  INSERT INTO public.audit_events(
    organization_id,actor_user_id,event_type,entity_type,entity_id,details
  ) VALUES (
    '61000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    'contact_permission_withdrawn','contact',
    '62000000-0000-4000-8000-000000000003',
    '{"channel":"voice","source":"campaign_manager_opt_out"}'
  ) RETURNING id INTO audit_id;
  IF audit_id IS NULL THEN
    RAISE EXCEPTION 'FAIL: viewer cannot record evidence-backed own opt-out';
  END IF;
  BEGIN
    INSERT INTO public.audit_events(
      organization_id,actor_user_id,event_type,entity_type,entity_id,details
    ) VALUES (
      '61000000-0000-4000-8000-000000000001',
      '00000000-0000-0000-0000-000000000002',
      'contact_permission_withdrawn','contact',
      '62000000-0000-4000-8000-000000000001',
      '{"channel":"whatsapp","source":"campaign_manager_opt_out"}'
    );
  EXCEPTION WHEN insufficient_privilege THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'FAIL: viewer wrote other-tenant audit'; END IF;
END
$check_beta$;
RESET ROLE;
DO $admin_verify$
BEGIN
  IF (SELECT count(*) FROM public.audit_events
      WHERE organization_id='61000000-0000-4000-8000-000000000001') <> 1
    OR (SELECT count(*) FROM public.audit_events
      WHERE organization_id='61000000-0000-4000-8000-000000000002') <> 1 THEN
    RAISE EXCEPTION 'FAIL: unexpected audit event count after rejected attempts';
  END IF;
END $admin_verify$;
SELECT 'PASS: audit inserts require same-tenant consent withdrawal and durable suppression, rolled back' AS verdict;
ROLLBACK;
