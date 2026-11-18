# Customer Support Centre — staging release checklist

**Status:** GitHub draft implementation, **not deployed**, **not production-ready**.

## Implemented
- Browser-only demo: `support-centre-preview.html`.
- Authenticated staging UI: `support-portal.html`.
- Supabase migration: `supabase/migrations/20261118_support_centre.sql`.
- Customer ticket creation, personal ticket list, ticket history and customer replies.
- Owner support desk, status changes and support replies.
- Customer isolation through RLS and owner-only RPC, subject to verification in the actual Supabase environment.
- Customer replies reopen tickets marked Resolved or Waiting for Customer; Closed tickets reject replies.

## Deployment prerequisites (not yet confirmed)
1. Confirm the actual Supabase project matches `supabase-config.js`. Do **not** use a different project just because an organization is open in the browser.
2. Review and apply migration in the correct Supabase SQL Editor. **No claim that it has been run.**
3. Confirm verified owner login uses `aarohananalytics951@gmail.com`; update the allowlist only through a controlled change.
4. Configure Supabase Auth Site URL and redirect allowlist for the exact production `support-portal.html` URL; verify OTP email delivery and email confirmation.
5. Add service-side abuse/rate limits and monitoring; email OTP rate limits alone do not rate-limit ticket creation.
6. Verify migration and UI against the actual Supabase SDK. This branch has not had live browser end-to-end testing.
7. Implement private attachments with storage RLS, notification email and support-team roles before claiming those features.
8. Review privacy policy, retention/deletion handling, backup/restore and access logging for real customer data.
9. Do not merge or deploy before the security tests below pass.

## Acceptance tests (must be run with two separate verified accounts)
- [ ] Unauthenticated requests cannot read, insert or update tickets/events.
- [ ] Customer A can create and read own ticket; customer B cannot read it by ID, in lists or through event history.
- [ ] Customer A cannot set ticket number, customer_id, status, assigned_to, created_at or updated_at.
- [ ] Customer A cannot call the owner status-update RPC.
- [ ] Customer A can reply to own Open ticket; reply appears in history.
- [ ] Customer A cannot reply to customer B's ticket, even if UUID is known.
- [ ] Reply to Resolved/Waiting for Customer reopens ticket; reply to Closed fails.
- [ ] Customer cannot directly insert fake events or edit event history.
- [ ] Owner can see all tickets, change status and reply; change is audited.
- [ ] Owner's support replies are correctly labelled customer-visible, not private notes.
- [ ] Long/blank text is rejected, and submitted text cannot execute HTML or JavaScript.
- [ ] Mobile login, signout, expired session, refresh, missing database and network errors are handled.
- [ ] OTP redirect returns to correct page without losing session.
- [ ] Existing site pages, domain and other Supabase tables are unaffected.

**Security note:** the demo and staging code are separate. Do not enter actual customer data into the browser-only demo. Staging relies on the migration and verified authentication; no claim of production readiness is made.
