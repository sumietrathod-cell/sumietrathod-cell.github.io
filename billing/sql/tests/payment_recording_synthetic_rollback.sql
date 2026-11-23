-- REVIEW-ONLY synthetic smoke tests. Run ONLY in an isolated test DB.
-- Prerequisites: private schema + record_verified_payment review migrations.
-- ROLLBACK intentionally leaves no persistent test data.
BEGIN;
DO $$
DECLARE
 v_first text;
 v_repeat text;
 v_second text;
 v_hash text := repeat('a',64);
BEGIN
 v_first:=billing_private.record_verified_payment(
 'evt_SynthRec001','payment.captured',v_hash,'pay_SynthRec001',
 'synthetic-invoice-001',12000,'INR',false,false);
 IF v_first IS DISTINCT FROM 'recorded' THEN
   RAISE EXCEPTION 'First verified payment was not recorded';
 END IF;
 v_repeat:=billing_private.record_verified_payment(
 'evt_SynthRec001','payment.captured',v_hash,'pay_SynthRec001',
 'synthetic-invoice-001',12000,'INR',false,false);
 IF v_repeat IS DISTINCT FROM 'duplicate' THEN
   RAISE EXCEPTION 'Repeated event was not deduplicated';
 END IF;
 v_second:=billing_private.record_verified_payment(
 'evt_SynthRec002','payment.captured',repeat('b',64),'pay_SynthRec001',
 'synthetic-invoice-001',12000,'INR',false,false);
 IF v_second IS DISTINCT FROM 'duplicate' THEN
   RAISE EXCEPTION 'Second event for same payment was not deduplicated';
 END IF;
 IF (SELECT count(*) FROM billing_private.verified_payments
     WHERE payment_id='pay_SynthRec001')<>1 THEN
   RAISE EXCEPTION 'Duplicate verified payment inserted';
 END IF;
 IF (SELECT count(*) FROM billing_private.webhook_events
     WHERE event_id IN ('evt_SynthRec001','evt_SynthRec002'))<>2 THEN
   RAISE EXCEPTION 'Expected both webhook event IDs to be recorded';
 END IF;
END $$;
ROLLBACK;
-- Additional tests required: conflicting event hashes, conflicting payment
-- amount/invoice, concurrent transaction races, rollback on exceptions.
