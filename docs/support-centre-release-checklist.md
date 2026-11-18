# Customer Support Centre — staging release checklist

**Status** — The database migration is applied in AAROHAN CRM Staging (`aubzgcgljfszbgnnlzbn`). The portal remains a GitHub draft and has no deployed preview URL.

## Implemented
- Browser-only demo: `support-centre-preview.html`.
- Authenticated staging UI: `support-portal.html`.
- Supabase migration: `supabase/migrations/20261118_support_centre.sql`.
- Customer ticket creation, personal ticket list, ticket history and customer replies.
- Owner support desk, status changes and support replies.
- Staging database tests used two synthetic customers and the verified owner to check row-level security, restricted writes, and the ticket workflow. The test transaction was rolled back.
- The portal has its own staging connection and browser session storage. Other modules continue to use their existing configuration.
- Customer replies reopen tickets marked Resolved or Waiting for Customer; Closed tickets reject replies.

## Remaining release work

1. Establish the staging portal URL and add only its exact Auth redirect. Verify magic-link delivery, email confirmation and return to the portal on mobile.
2. Configure a custom SMTP sender for customer addresses. The default Supabase sender currently limits delivery to organization members. Preserve the existing Auth configuration for other modules.
3. Add server-side ticket and reply rate limits with monitoring.
4. Test the deployed portal via the Supabase SDK with two separately signed-in test accounts and the verified owner.
5. Implement private attachments, notifications and support-team roles before offering those features. Review privacy, retention, backups and access logging before accepting real customer tickets.

## Acceptance tests

The checked items passed in staging through SQL with simulated authenticated roles or explicit grant checks. They still need confirmation through the deployed portal where applicable.
- [x] Anonymous table reads, new ticket creation and support RPC execution are denied by grants.
- [x] Customer A can create and read their own ticket. Customer B cannot read it or its history by ID.
- [ ] Check the deployed customer ticket list with both accounts.
- [x] Customer A cannot set ticket number, customer ID or status, or update ticket columns directly.
- [ ] Confirm the remaining generated fields are denied through the API.
- [x] Customer A cannot call the owner status-update RPC.
- [x] Customer A can reply to their own Open ticket.
- [x] Customer A cannot reply to customer B's ticket, even if UUID is known.
- [x] Reply to Resolved reopens the ticket, and reply to Closed fails.
- [ ] Check reopening from Waiting for Customer in the portal.
- [x] Customer has no direct event insert privileges.
- [x] The verified owner can update and reply to a customer ticket. The reply is recorded in its history.
- [ ] Owner's support replies are correctly labelled customer-visible, not private notes.
- [ ] Long/blank text is rejected, and submitted text cannot execute HTML or JavaScript.
- [ ] Mobile login, signout, expired session, refresh, missing database and network errors are handled.
- [ ] OTP redirect returns to correct page without losing session.
- [ ] Existing site pages, domain and other Supabase tables are unaffected.

Use synthetic data in both the browser-only demo and the staging portal.
