# AAROHAN AI WORLD — Billing Payments Release Notes

Status as of 2026-11-23: **backend infrastructure installed**, customer payment automation **NOT verified live**.

## Already done
- Existing billing quotation and commercial invoice draft UI remains in place.
- On existing Supabase project `zvrdbekyqbwrztckvkpw`, applied migration `billing_payment_orders_verified_20261123`.
- New `public.billing_payment_orders` and `public.billing_verified_payments` tables are empty and protected by RLS (admin read, server-only insert). No real or synthetic transactions were inserted.
- Supabase Edge Function `billing-payment` deployed with `verify_jwt=true` and independently validated `app_metadata.campaign_manager_role=admin`. It can list historical verification entries without Razorpay secrets, but payment-creating / provider-check actions fail closed until keys are present.
- Admin-only static payment history page lists last 50 verified transactions, without claiming they are current paid balances or settled revenue.
- Non-GST payment-acknowledgement *preview* checks live provider capture, order match, amount, refund status on view and again immediately before printing.
- Synthetic payment contract and request-flow tests run under GitHub Actions. These do **not** simulate live Razorpay credentials.

## Must finish before enabling customer payments
1. Add two separate Razorpay secrets in **Supabase Dashboard > Edge Functions > Secrets** for the correct project: `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`. Start with test-mode credentials. Do not commit, email or share secret values in chat. The owner must control this step.
2. Create and pay a test-mode invoice/order using Razorpay's documented checkout flow (including server-side payment verification); test failed checkout, duplicate callback, refunds, disputes and incorrect invoice/payment mapping.
3. Implement customer-authorized invoice-specific checkout UI and verify Razorpay signature on server when using Checkout callbacks, or use server-side fetched captured-payment data as authoritative. Existing generic payment-page URL is not invoice-specific.
4. Decide whether a legally reviewed, non-GST final invoice/receipt may be issued, and ensure no GST is collected without valid GST registration.
5. Add live operational controls: API quotas/rate limiting, refunds/chargeback monitoring, reconciliation of settlements and alerts.
6. Switch from test credentials to live-mode secrets only after authorized real transaction acceptance test, and verify dashboards/PDF on mobile.

## Security / support
- Never report a `paid` status based only on browser callback or historical ledger.
- No payment secrets in this repo or the browser.
- No auto-refunds or manual cash/bank payment reconciliation in this release.
- The Supabase security advisor also flags some **pre-existing** security-definer functions; those should be reviewed separately rather than changed during this billing release.
