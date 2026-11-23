-- SYNTHETIC QA ONLY. Run in disposable/staging DB AFTER review migrations.
-- Entire test is rolled back; never run against customer production data.
BEGIN;
DO $$
DECLARE
 a record;
 b record;
 c record;
BEGIN
 INSERT INTO billing_private.verified_payments(payment_id,invoice_id,amount_paise,currency)
 VALUES
 ('pay_SyntheticReceiptA','synthetic-invoice-A',12500,'INR'),
 ('pay_SyntheticReceiptB','synthetic-invoice-B',35000,'INR');
 SELECT * INTO a FROM billing_private.allocate_receipt('pay_SyntheticReceiptA','2026-27');
 IF a.receipt_number IS NULL OR a.receipt_number !~ '^AAR-REC-2026-27-[0-9]+$'
 THEN RAISE EXCEPTION 'Missing receipt number'; END IF;
 SELECT * INTO b FROM billing_private.allocate_receipt('pay_SyntheticReceiptA','2026-27');
 IF a.receipt_id <> b.receipt_id OR a.receipt_number <> b.receipt_number
 THEN RAISE EXCEPTION 'Duplicate receipt issued on retry'; END IF;
 SELECT * INTO c FROM billing_private.allocate_receipt('pay_SyntheticReceiptB','2026-27');
 IF c.receipt_id = a.receipt_id OR c.receipt_number = a.receipt_number
 THEN RAISE EXCEPTION 'Receipt number collision'; END IF;
 IF (SELECT count(*) FROM billing_private.payment_receipts
     WHERE payment_id IN ('pay_SyntheticReceiptA','pay_SyntheticReceiptB')) <> 2
 THEN RAISE EXCEPTION 'Unexpected receipt count'; END IF;
END $$;
ROLLBACK;
-- This tests sequential behavior only; separate concurrent transaction testing
-- and invoice/provider reconciliation are mandatory before production.
