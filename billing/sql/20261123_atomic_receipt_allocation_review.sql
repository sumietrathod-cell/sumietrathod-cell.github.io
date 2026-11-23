-- REVIEW ONLY: PostgreSQL receipt allocation prototype. NOT deployed.
-- Prerequisite: private schema in 20261123_private_payment_receipts_review.sql.
-- IMPORTANT: verified_payments MUST be populated exclusively by a trusted
-- backend after independent Razorpay API reconciliation, invoice amount/currency
-- match, and refund/dispute checks. Never grant client roles execute rights.
-- SECURITY INVOKER is intentional: caller needs explicit server-only privileges.
BEGIN;
CREATE OR REPLACE FUNCTION billing_private.allocate_receipt(
 p_payment_id text,
 p_financial_year text
) RETURNS TABLE(receipt_id bigint, receipt_number text)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog
AS $$
DECLARE
 v_payment billing_private.verified_payments%ROWTYPE;
 v_existing billing_private.payment_receipts%ROWTYPE;
 v_next bigint;
 v_id bigint;
BEGIN
 IF p_financial_year IS NULL OR
    p_financial_year !~ '^[0-9]{4}-[0-9]{2}$' OR
    right(p_financial_year,2)::integer <>
      ((left(p_financial_year,4)::integer + 1) % 100) THEN
   RAISE EXCEPTION 'Invalid financial year';
 END IF;
 -- Serialize retries for the same payment, including competing callers.
 SELECT * INTO v_payment FROM billing_private.verified_payments
 WHERE payment_id=p_payment_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Payment is not reconciled'; END IF;
 IF v_payment.refunded OR v_payment.disputed THEN
   RAISE EXCEPTION 'Payment is not eligible for receipt';
 END IF;
 SELECT * INTO v_existing FROM billing_private.payment_receipts
 WHERE payment_id=p_payment_id;
 IF FOUND THEN
   receipt_id:=v_existing.receipt_id;
   receipt_number:='AAR-REC-'||v_existing.financial_year||'-'||
     lpad(v_existing.sequence_number::text,6,'0');
   RETURN NEXT; RETURN;
 END IF;
 -- Row-level conflict serializes counter increments across different payments.
 INSERT INTO billing_private.receipt_counters(financial_year,last_number)
 VALUES(p_financial_year,1)
 ON CONFLICT(financial_year) DO UPDATE
 SET last_number=billing_private.receipt_counters.last_number+1
 RETURNING last_number INTO v_next;
 INSERT INTO billing_private.payment_receipts(
  financial_year,sequence_number,payment_id,invoice_id,amount_paise
 ) VALUES(p_financial_year,v_next,v_payment.payment_id,
          v_payment.invoice_id,v_payment.amount_paise)
 RETURNING billing_private.payment_receipts.receipt_id INTO v_id;
 receipt_id:=v_id;
 receipt_number:='AAR-REC-'||p_financial_year||'-'||lpad(v_next::text,6,'0');
 RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION billing_private.allocate_receipt(text,text)
 FROM PUBLIC, anon, authenticated;
COMMIT;
-- STILL REQUIRED: invoice foreign keys/immutability, financial-year policy,
-- receipt reversal audit, backend grants, provider verification and tests.
