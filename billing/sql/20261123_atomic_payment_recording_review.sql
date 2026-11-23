-- REVIEW ONLY. Not applied to Supabase. Requires prior private schema review.
-- SECURITY: only a trusted backend may call this with freshly verified provider
-- data. Client input, browser sessions, or unverified webhook payloads are NEVER
-- sufficient to mark a payment verified. Do not grant anon/authenticated EXECUTE.
-- This function atomically deduplicates event ID and payment ID, and checks
-- invoice linkage against an existing verified record. Invoice locking/foreign
-- keys must be added after inspecting the actual billing invoice schema.
BEGIN;
CREATE OR REPLACE FUNCTION billing_private.record_verified_payment(
 p_event_id text,
 p_event_type text,
 p_payload_sha256 text,
 p_payment_id text,
 p_invoice_id text,
 p_amount_paise bigint,
 p_currency text,
 p_refunded boolean,
 p_disputed boolean
) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog
AS $$
DECLARE
 v_existing billing_private.verified_payments%ROWTYPE;
 v_existing_event billing_private.webhook_events%ROWTYPE;
BEGIN
 IF p_event_id IS NULL OR p_event_id !~ '^[A-Za-z0-9_-]{8,128}$'
 OR p_event_type IS DISTINCT FROM 'payment.captured'
 OR p_payload_sha256 IS NULL OR p_payload_sha256 !~ '^[a-f0-9]{64}$'
 OR p_payment_id IS NULL OR p_payment_id !~ '^pay_[A-Za-z0-9]+$'
 OR p_invoice_id IS NULL OR btrim(p_invoice_id) = ''
 OR p_amount_paise IS NULL OR p_amount_paise <= 0
 OR p_currency IS DISTINCT FROM 'INR'
 OR p_refunded IS DISTINCT FROM false OR p_disputed IS DISTINCT FROM false THEN
   RAISE EXCEPTION 'Invalid verified payment record';
 END IF;

 -- Concurrent retries of the same event serialize on the unique event ID.
 INSERT INTO billing_private.webhook_events(event_id,event_type,payload_sha256)
 VALUES(p_event_id,p_event_type,p_payload_sha256)
 ON CONFLICT(event_id) DO NOTHING;
 IF NOT FOUND THEN
   SELECT * INTO v_existing_event FROM billing_private.webhook_events
   WHERE event_id=p_event_id FOR UPDATE;
   IF v_existing_event.payload_sha256 IS DISTINCT FROM p_payload_sha256
      OR v_existing_event.event_type IS DISTINCT FROM p_event_type THEN
     RAISE EXCEPTION 'Event replay with conflicting payload';
   END IF;
   RETURN 'duplicate';
 END IF;

 -- Payment uniqueness is separately enforced for different event IDs.
 INSERT INTO billing_private.verified_payments(
  payment_id,invoice_id,amount_paise,currency,refunded,disputed
 ) VALUES(p_payment_id,p_invoice_id,p_amount_paise,p_currency,false,false)
 ON CONFLICT(payment_id) DO NOTHING;
 IF NOT FOUND THEN
   SELECT * INTO v_existing FROM billing_private.verified_payments
   WHERE payment_id=p_payment_id FOR UPDATE;
   IF v_existing.invoice_id IS DISTINCT FROM p_invoice_id
      OR v_existing.amount_paise IS DISTINCT FROM p_amount_paise
      OR v_existing.currency IS DISTINCT FROM p_currency
      OR v_existing.refunded IS DISTINCT FROM false
      OR v_existing.disputed IS DISTINCT FROM false THEN
     RAISE EXCEPTION 'Payment replay with conflicting reconciliation';
   END IF;
   UPDATE billing_private.webhook_events SET processed_at=now()
   WHERE event_id=p_event_id;
   RETURN 'duplicate';
 END IF;
 UPDATE billing_private.webhook_events SET processed_at=now()
 WHERE event_id=p_event_id;
 RETURN 'recorded';
END;
$$;
REVOKE ALL ON FUNCTION billing_private.record_verified_payment(
 text,text,text,text,text,bigint,text,boolean,boolean
) FROM PUBLIC,anon,authenticated;
COMMIT;
-- BLOCKERS BEFORE APPLYING: confirm invoice schema and lock invoice row;
-- enforce invoice/order/amount invariants in DB, least-privilege backend grants,
-- real provider/dispute checks, audit trails, integration/concurrency tests.
