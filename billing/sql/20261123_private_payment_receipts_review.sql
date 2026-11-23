-- REVIEW ONLY. Not applied to any database.
-- Private backend-owned tables. No browser/client access.
BEGIN;
CREATE SCHEMA IF NOT EXISTS billing_private;
REVOKE ALL ON SCHEMA billing_private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS billing_private.webhook_events (
 event_id text PRIMARY KEY CHECK (length(event_id) BETWEEN 8 AND 128),
 event_type text NOT NULL,
 payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
 received_at timestamptz NOT NULL DEFAULT now(),
 processed_at timestamptz
);
CREATE TABLE IF NOT EXISTS billing_private.verified_payments (
 payment_id text PRIMARY KEY CHECK (payment_id ~ '^pay_[A-Za-z0-9]+$'),
 invoice_id text NOT NULL,
 amount_paise bigint NOT NULL CHECK (amount_paise > 0),
 currency text NOT NULL CHECK (currency = 'INR'),
 verified_at timestamptz NOT NULL DEFAULT now(),
 refunded boolean NOT NULL DEFAULT false,
 disputed boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS billing_private.receipt_counters (
 financial_year text PRIMARY KEY CHECK (financial_year ~ '^[0-9]{4}-[0-9]{2}$'),
 last_number bigint NOT NULL DEFAULT 0 CHECK (last_number >= 0)
);
CREATE TABLE IF NOT EXISTS billing_private.payment_receipts (
 receipt_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 financial_year text NOT NULL REFERENCES billing_private.receipt_counters(financial_year),
 sequence_number bigint NOT NULL CHECK (sequence_number > 0),
 payment_id text NOT NULL UNIQUE REFERENCES billing_private.verified_payments(payment_id),
 invoice_id text NOT NULL,
 amount_paise bigint NOT NULL CHECK (amount_paise > 0),
 issued_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(financial_year,sequence_number)
);
REVOKE ALL ON ALL TABLES IN SCHEMA billing_private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA billing_private FROM PUBLIC, anon, authenticated;
COMMIT;
-- Before deployment: confirm existing invoice schema, apply least-privilege
-- server grants, atomic transaction with invoice locking, replay-safe event
-- insertion and counter allocation, verified provider capture/refund state,
-- idempotent receipt issuance, tests and owner approval.
