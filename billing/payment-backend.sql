-- AAROHAN AI WORLD — schema applied to existing billing Supabase project on 2026-11-23; retained here for reproducibility.
-- One Razorpay order and at most one captured payment per existing invoice.
-- Requires actual admin authorization and provider verification inside Edge Function.
-- No GST or legal tax-invoice logic, no refunds/partial payments.
BEGIN;

CREATE TABLE IF NOT EXISTS public.billing_payment_orders (
 invoice_id uuid PRIMARY KEY REFERENCES public.billing_invoices(id) ON DELETE RESTRICT,
 razorpay_order_id text NOT NULL UNIQUE CHECK (razorpay_order_id ~ '^order_[A-Za-z0-9]{6,48}$'),
 amount_paise bigint NOT NULL CHECK (amount_paise BETWEEN 100 AND 10000000000),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (invoice_id,razorpay_order_id)
);

CREATE TABLE IF NOT EXISTS public.billing_verified_payments (
 razorpay_payment_id text PRIMARY KEY CHECK (razorpay_payment_id ~ '^pay_[A-Za-z0-9]{6,48}$'),
 invoice_id uuid NOT NULL UNIQUE,
 razorpay_order_id text NOT NULL,
 amount_paise bigint NOT NULL CHECK (amount_paise BETWEEN 100 AND 10000000000),
 verified_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (invoice_id,razorpay_order_id)
   REFERENCES public.billing_payment_orders(invoice_id,razorpay_order_id) ON DELETE RESTRICT
);

ALTER TABLE public.billing_payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_verified_payments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.billing_payment_orders FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.billing_verified_payments FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.billing_payment_orders,public.billing_verified_payments TO authenticated;
GRANT SELECT,INSERT ON public.billing_payment_orders,public.billing_verified_payments TO service_role;

CREATE POLICY billing_payment_orders_admin_read ON public.billing_payment_orders
 FOR SELECT TO authenticated USING (
 (auth.jwt()->'app_metadata'->>'campaign_manager_role')='admin'
);
CREATE POLICY billing_verified_payments_admin_read ON public.billing_verified_payments
 FOR SELECT TO authenticated USING (
 (auth.jwt()->'app_metadata'->>'campaign_manager_role')='admin'
);

COMMIT;
