# AAROHAN AI WORLD — Partner Access (secure backend pending)

This GitHub Pages site is STATIC. A real Partner Login cannot be safely implemented
with browser-local passwords, Google Sheets sharing, or an unprotected public endpoint.

Deployment status:
- Existing public marketing portal: /partner-portal.html — LIVE
- Private owner Google Sheets CRM: existing, owner-only, NOT public
- Secure partner access UI: /partner-access.html — published but DISABLED until backend connected
- Database migration: supabase/migrations/20261113_partner_core.sql — CREATED, NOT EXECUTED
- Commission payout: manual owner review ONLY, automatic bank payments are NOT connected

Activate only after:
1. Install/connect Supabase plugin or securely sign into a Supabase project.
2. Create a Supabase project and APPLY the SQL migration in its private SQL editor.
3. Configure allowed authentication redirect: https://aarohanaiworld.com/partner-access.html
4. Put the PROJECT URL and PUBLIC PUBLISHABLE KEY (sb_publishable_...) in
   /partner-config.js. The publishable key is public; row-level security protects data.
   NEVER commit SUPABASE SECRET KEYS, service_role keys, OTPs, passwords or bank details.
5. Sign in as owner and bootstrap admin using a private privileged SQL command:
   UPDATE public.partner_profiles SET role='admin', status='approved', approved_at=now()
   WHERE id='<verified OWNER auth.users UUID>';
   Verify the UUID in Supabase authentication first. Do not copy the example literally.
6. Test RLS with 2 independent partner accounts and an admin account. Check:
   anon cannot read data; pending cannot create leads; approved partners see only own
   leads/deals/commissions; only admin can approve; admin cannot grant itself through public UI.
7. Test signup, consent, email sign-in, partner approval, duplicate lead review and logging.
8. Commission payouts MUST remain human-approved and manually recorded until a
   regulated payment provider, KYB/KYC and explicit owner approval are set up.

Warning: partner-contact fields are personal data. Use consent and appropriate privacy
terms for each target region, including where required by international law.

Current manual owner CRM: 
https://docs.google.com/spreadsheets/d/191aoDSgQOnjkWx6Hll2Ryj3X8u4SuJUxUp1HIttstss/edit

Do not publish or embed that private CRM URL in partner-facing pages.
