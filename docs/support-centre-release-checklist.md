# Customer Support Centre — staging release checklist

**Status** — The database migration is applied in AAROHAN CRM Staging (`aubzgcgljfszbgnnlzbn`). The source remains a GitHub draft. The [owner-only staging preview](https://aarohan-support-staging.sumietrathod.chatgpt.site/) is deployed separately from the public website.

## Implemented
- Browser-only demo: `support-centre-preview.html`.
- Authenticated staging UI: `support-portal.html`.
- Supabase migration: `supabase/migrations/20261118_support_centre.sql`.
- Customer ticket creation, personal ticket list, ticket history and customer replies.
- Owner support desk, status changes and support replies.
- Staging database tests used two synthetic customers and the verified owner to check row-level security, restricted writes, and the ticket workflow. The test transaction was rolled back.
- The portal has its own staging connection and browser session storage. Other modules continue to use their existing configuration.
- Client-side session cleanup now discards cached tickets and stale in-flight ticket-list results on signout or account switch; browser verification remains pending.
- Support ticket list now uses 100-record pages with an explicit Load more control instead of silently limiting the list to 200 records. Search and status filters apply to the currently loaded pages, not all server records.
- Customer replies reopen tickets marked Resolved or Waiting for Customer; Closed tickets reject replies.

## Remaining release work

1. Verify the test magic link arrives and opens the private portal on mobile. The exact staging redirect is already allowlisted in Supabase. The existing CRM Site URL was preserved.
2. Configure a custom SMTP sender for customer addresses. The default Supabase sender currently limits delivery to organization members. Preserve the existing Auth configuration for other modules.
3. Review and apply `supabase/migrations/20261118_support_post_staging_hardening.sql` in the same staging project; this incremental migration adds per-account ticket/reply limits. **It has not been run.** Add IP/edge abuse controls and monitoring separately.
4. Test the deployed portal via the Supabase SDK with two separately signed-in test accounts and the verified owner.
5. Implement private attachments, notifications and support-team roles before offering those features. Review privacy, retention, backups and access logging before accepting real customer tickets.

The hosted preview rendered its sign-in form behind the owner-only access gate. Supabase accepted the test sign-in request for the organization owner. Successful inbox delivery and the portal session after opening the link are separate checks.

## Acceptance tests

The checked items passed in staging through SQL with simulated authenticated roles or explicit grant checks. They still need confirmation through the deployed portal where applicable.
- [x] Anonymous table reads, new ticket creation and support RPC execution are denied by grants.
- [x] Customer A can create and read their own ticket. Customer B cannot read it or its history by ID.
- [ ] Check the deployed customer ticket list with both accounts.
- [ ] After incremental migration: confirm ticket throttling (8/hour, 30/day) and customer reply throttling (20/hour, 100/day) with concurrent requests.
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
- [ ] During a slow ticket fetch, sign out and sign into another account; confirm the first account's ticket list never reappears.
- [ ] With 201+ tickets, verify pagination, Load more, duplicate handling, search/filter behavior and refresh after ticket creation.
- [ ] OTP redirect returns to correct page without losing session.
- [ ] Existing site pages, domain and other Supabase tables are unaffected.

Use synthetic data in both the browser-only demo and the staging portal.
