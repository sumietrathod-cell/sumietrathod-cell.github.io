-- Disposable PostgreSQL 17 test of RLS-invoker atomic opt-out RPC.
-- Synthetic contacts only; no outbound providers. Whole transaction rolls back.
BEGIN;

INSERT INTO public.organizations(id,name) VALUES
 ('71000000-0000-4000-8000-000000000001','Atomic Alpha'),
 ('71000000-0000-4000-8000-000000000002','Atomic Beta');
INSERT INTO public.organization_members(organization_id,user_id,role) VALUES
 ('71000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000001','viewer'),
 ('71000000-0000-4000-8000-000000000002',
  '00000000-0000-0000-0000-000000000002','operator');
INSERT INTO public.contacts(id,organization_id,phone_e164) VALUES
 ('72000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','+919999000701'),
 ('72000000-0000-4000-8000-000000000002','71000000-0000-4000-8000-000000000001','+919999000702'),
 ('72000000-0000-4000-8000-000000000003','71000000-0000-4000-8000-000000000002','+919999000703'),
 ('72000000-0000-4000-8000-000000000004','71000000-0000-4000-8000-000000000001','+919999000704');

INSERT INTO public.contact_channel_permissions(
  organization_id,contact_id,channel,permission_status,evidence_reference,
  captured_at,captured_by
) VALUES (
  '71000000-0000-4000-8000-000000000001',
  '72000000-0000-4000-8000-000000000001',
  'whatsapp','granted','fictional-prior-consent','2026-01-01 00:00:00+00',
  '00000000-0000-0000-0000-000000000001'
), (
  '71000000-0000-4000-8000-000000000001',
  '72000000-0000-4000-8000-000000000004',
  'whatsapp','withdrawn',NULL,'2026-01-01 00:00:00+00',
  '00000000-0000-0000-0000-000000000001'
);
INSERT INTO public.suppression_list(
 organization_id,contact_id,phone_e164,channel,reason,source
) VALUES (
 '71000000-0000-4000-8000-000000000001',
 '72000000-0000-4000-8000-000000000004',
 '+919999000704','whatsapp','original_csv_withdrawal','csv_import'
);

-- Inject a deterministic failure on the THIRD write (audit). When this
-- happens the function invocation must roll back its first two writes.
CREATE OR REPLACE FUNCTION public.reject_atomic_audit_ci()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $body$
BEGIN
 IF NEW.entity_id='72000000-0000-4000-8000-000000000002'::uuid THEN
  RAISE EXCEPTION 'Synthetic audit failure; test whole transaction rollback'
    USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $body$;
CREATE TRIGGER reject_atomic_audit_ci
BEFORE INSERT ON public.audit_events
FOR EACH ROW EXECUTE FUNCTION public.reject_atomic_audit_ci();

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',true);

DO $verify$
DECLARE
 response jsonb;
 rejected boolean;
BEGIN
 response:=public.record_campaign_contact_opt_out(
   '72000000-0000-4000-8000-000000000001','whatsapp','customer_requested');
 IF response->>'success'<>'true' OR response->>'audit_recorded'<>'true' THEN
  RAISE EXCEPTION 'FAIL: successful opt-out must report atomic audit';
 END IF;
 IF NOT EXISTS (
    SELECT 1 FROM public.contact_channel_permissions
    WHERE contact_id='72000000-0000-4000-8000-000000000001'
      AND permission_status='withdrawn'
      AND evidence_reference='fictional-prior-consent'
      AND captured_at='2026-01-01 00:00:00+00'::timestamptz
 ) THEN RAISE EXCEPTION 'FAIL: permission withdrawal lost original proof'; END IF;

 PERFORM public.record_campaign_contact_opt_out(
   '72000000-0000-4000-8000-000000000001','whatsapp','duplicate_retry');
 IF (SELECT count(*) FROM public.suppression_list
    WHERE contact_id='72000000-0000-4000-8000-000000000001'
      AND channel='whatsapp')<>1 THEN
  RAISE EXCEPTION 'FAIL: repeated opt-out duplicated durable suppression'; END IF;
 IF (SELECT reason FROM public.suppression_list
    WHERE contact_id='72000000-0000-4000-8000-000000000001'
      AND channel='whatsapp')<>'customer_requested' THEN
  RAISE EXCEPTION 'FAIL: repeated opt-out rewrote original reason'; END IF;

 -- A prior CSV withdrawal can be safely reaffirmed via the same RPC.
 PERFORM public.record_campaign_contact_opt_out(
   '72000000-0000-4000-8000-000000000004','whatsapp','repeat_csv_withdrawal');
 IF (SELECT reason FROM public.suppression_list
    WHERE contact_id='72000000-0000-4000-8000-000000000004'
      AND channel='whatsapp')<>'original_csv_withdrawal' THEN
  RAISE EXCEPTION 'FAIL: CSV opt-out suppression was overwritten'; END IF;

 rejected:=false;
 BEGIN
  PERFORM public.record_campaign_contact_opt_out(
   '72000000-0000-4000-8000-000000000002','whatsapp','failure_injection');
 EXCEPTION WHEN check_violation THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'FAIL: audit failure not raised'; END IF;
 IF EXISTS (
   SELECT 1 FROM public.suppression_list
   WHERE contact_id='72000000-0000-4000-8000-000000000002'
 ) OR EXISTS (
   SELECT 1 FROM public.contact_channel_permissions
   WHERE contact_id='72000000-0000-4000-8000-000000000002'
 ) THEN RAISE EXCEPTION 'FAIL: audit failure left partial opt-out writes'; END IF;

 rejected:=false;
 BEGIN
  PERFORM public.record_campaign_contact_opt_out(
   '72000000-0000-4000-8000-000000000003','whatsapp','cross_tenant');
 EXCEPTION WHEN insufficient_privilege THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'FAIL: cross-tenant opt-out allowed'; END IF;

 rejected:=false;
 BEGIN
  PERFORM public.record_campaign_contact_opt_out(
   '72000000-0000-4000-8000-000000000001','unknown','invalid_channel');
 EXCEPTION WHEN invalid_parameter_value THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'FAIL: invalid channel accepted'; END IF;
 RAISE NOTICE 'PASS: real RLS-invoker opt-out is all-or-nothing, preserves prior consent proof, blocks foreign tenants and retries safely';
END $verify$;

RESET ROLE;
DO $check$
BEGIN
 IF (SELECT count(*) FROM public.audit_events
     WHERE organization_id='71000000-0000-4000-8000-000000000001'
       AND event_type='contact_permission_withdrawn')<>3 THEN
   RAISE EXCEPTION 'FAIL: audit count incorrect after first, retry, CSV, and rolled-back failure';
 END IF;
 IF EXISTS(
   SELECT 1 FROM public.suppression_list
   WHERE contact_id='72000000-0000-4000-8000-000000000002'
 ) THEN RAISE EXCEPTION 'FAIL: failed opt-out suppression persisted'; END IF;
END $check$;
SELECT 'PASS: 3 opt-out commits, 1 audit-triggered rollback, no external contact' AS verdict;
ROLLBACK;
