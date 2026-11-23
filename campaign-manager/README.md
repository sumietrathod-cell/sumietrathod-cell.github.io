# AAROHAN AI Campaign Manager

> **DEPLOYMENT SAFETY:** This draft multi-tenant schema is **not** a drop-in upgrade for the live AAROHAN CRM at https://aarohanaiworld.com/campaign-manager.html. That database already has a different `public.campaigns` table. Before a new install, run `campaign-manager/supabase/preflight.sql` in an **empty dedicated staging project**. If it fails, stop; never overwrite/alter production tables or policies to force it through. The tenant product is a separate staging design, not 100% live.

Own campaign orchestration product for AAROHAN AI WORLD. This repository currently contains a browser-only prototype at `campaign-manager-demo.html`. The prototype simulates campaign outcomes; it does not place calls or send WhatsApp messages.

## Planned architecture
- Web dashboard: campaign setup, CSV contact import, consent review, campaign monitoring, callbacks, suppression list, exports.
- API: authenticated, tenant-scoped campaign and contact operations.
- Database: PostgreSQL/Supabase with row-level security (RLS).
- Worker: scheduled, idempotent outreach jobs with attempt limits and calling windows.
- Channel adapters: pluggable telephony and WhatsApp Business providers. Provider credentials remain server-side.
- AI orchestration: configurable conversation goals, approved scripts, handoff rules, outcome classification and summaries.

## Non-negotiable safety controls
1. Require evidence of a lawful basis/permission for each channel before enrollment.
2. Suppress do-not-contact, opt-out, invalid and blocked contacts before every attempt.
3. Enforce tenant isolation, per-campaign limits, attempt caps and local calling windows server-side.
4. Log consent source/time, campaign changes, attempts, outcomes and opt-outs in an audit trail.
5. Start in dry-run mode. Live outreach remains disabled until provider credentials, compliance settings and explicit operator approval are configured.
6. Never commit API keys, access tokens, service-role keys or personal contact lists.

## Build status
- [x] Browser simulation prototype
- [x] Initial database schema draft
- [x] Draft tenant-scoped RLS policies; opt-out reversal guard and no client DELETE policy added (staging integration validation still required)
- [ ] Auth, tenant provisioning and RLS verification (API starter added; staging validation pending)
- [x] API contract and CSV validation requirements drafted
- [x] Initial authenticated campaign API routes (me, list/create draft campaigns, paginated campaign contacts, guarded CSV import and read-only preview; staging deployment pending)\n- [x] CSV import endpoint starter (1 MB / 500-row limits; partial writes are reported; staging tests pending)\n- [x] Initial authenticated dashboard UI (connect, sign in, organizations, draft creation, CSV import, paginated contacts, eligibility preview and channel opt-out; staging connection pending)
- [ ] Production-ready customer-facing contact management UI and staging validation
- [ ] Durable scheduler/worker and idempotency
- [x] Initial channel-specific opt-out/suppression endpoint (staging tests pending)
- [ ] Callback and provider webhook workflows
- [ ] Provider adapters and webhook verification
- [x] GitHub Actions Deno type-check, PostgreSQL SQL parse and dashboard static checks pass on current draft PR head
- [ ] Automated integration/RLS tests, deployment and monitoring
- [ ] Security and compliance review before live use

## Security and API design notes
- `supabase/rls-policies.sql` adds fail-closed tenant membership policies; apply only in staging and test with multiple organizations.
- `API_CONTRACT.md` defines the required authenticated API, import validation, last-moment eligibility gate, queue guarantees and live activation checklist.\n- `supabase/functions/campaign-api/index.ts` is an initial JWT-verified, user-scoped Edge Function starter; it uses RLS, creates draft campaigns only, and imports contacts with channel permission evidence. It does not send outreach.\n- `EDGE_FUNCTION_DEPLOYMENT.md` documents staging setup and tests. The function has not been deployed.
- The SQL policies are a draft, not a substitute for independent security review or integration tests.


## Outbound eligibility safety (staging draft)
- `claim_due_campaign_jobs` now requires a **real non-empty consent evidence reference**, a non-future `captured_at` timestamp and a `captured_by` actor before considering any voice/WhatsApp job.
- Campaigns must configure **both** calling-window times, with `start < end`. Missing windows and overnight ranges now **fail closed**; an absent window is **not** treated as 24/7 authorization.
- All existing checks still require an active non-dry-run campaign, a queued eligible enrollment, valid E.164 phone, non-suppressed channel, and bounded attempt count.
- Verified in `supabase/tests/queue-claim-eligibility.sql` using 11 synthetic jobs and the same proposed claim function translated to temporary tables. One eligible job was claimed; all other jobs stayed queued. The whole transaction rolled back.
- **No outbound provider is connected, no job worker is scheduled, and no contact was messaged.** An explicit calling window is not sufficient for legal compliance; a future provider must recheck the actual recipient's time zone, jurisdiction, opt-out, consent and platform restrictions immediately before each send.

## Stale outbound job safety (staging draft)
- `campaign-manager/supabase/queue-worker.sql` contains a **service-role-only** `quarantine_stale_campaign_jobs` function to isolate claims whose processing lease is stale.
- Quarantine marks old processing jobs as `failed` with `stale_claim_needs_manual_review`, clears lock metadata, and **never requeues or sends**. A worker crash may occur *after* a provider accepted an outbound message, so automatic retry could duplicate it.
- The routine is **not scheduled**, and the campaign worker/provider dispatch system is **not live**. Before any customer release, reconcile each stale claim against provider receipts, build safe audited reconciliation, and verify exactly-once outcomes with real providers.
- A synthetic PostgreSQL transaction test is stored at `campaign-manager/supabase/tests/queue-quarantine.sql`; it uses only temporary data and ends with ROLLBACK. `scripts/check-campaign-queue.mjs` verifies that the test's function source matches the proposed implementation and that authenticated users cannot execute it.

## Consent/opt-out policy hardening (staging draft)
- The contact-channel permission operator policy is split into INSERT and UPDATE. Direct authenticated DELETE access is deliberately not provided.
- Database trigger `public.guard_contact_channel_permission()` prohibits changing tenant/contact/channel IDs, reinstalling previously withdrawn permission via UPDATE, or granting permission without evidence reference, actor and timestamp.
- A local-equivalent synthetic temporary-table SQL transaction passed 5 scenarios; the actual staging policy and multi-tenant user flows still require independent E2E verification.
- Re-run the `campaign-manager/supabase/tests/permission-guard.sql` rollback test **in dedicated staging**, not against the old production CRM.
- Granting permission still requires an independent operator review that evidence is legitimate. Neither a database guard nor a CSV string independently proves consent.

## Local development (planned)
The backend framework and deployment target will be finalized before production implementation. Do not treat this prototype or schema draft as production-ready.


## Browser demos and dashboard
- Authenticated campaign dashboard (Supabase connection, draft campaigns, CSV import, paginated contacts, preview and opt-out): `../campaign-manager-dashboard.html`
- Campaign overview and simulated outreach: `../campaign-manager-demo.html`
- Contact workspace (CSV import, permission review, filtering and export): `../campaign-contacts-demo.html`

The two demo pages use browser-only sample data and never contact anyone. The authenticated dashboard can connect to the backend only after a Supabase staging project is configured and the Edge Function is deployed. It does not send or queue outreach.


## Latest backend increment
- Added authenticated read-only `POST /functions/v1/campaign-api/campaigns/{id}/preview` eligibility checks for voice/WhatsApp campaigns. It reports permission/evidence, suppression, invalid-contact, processed-status and attempt-limit blocks. It never dispatches outreach and is limited to 4,999 enrolled contacts per request.

- Latest API increment: paginated `GET /campaigns/{id}/contacts` now returns campaign contact details plus channel permission/evidence-present and suppression flags. Composite organization foreign keys were added to the fresh-install schema to reduce cross-tenant reference risks. Staging validation and any required migration for an already-existing database remain outstanding.

- Consent handling increment: CSV import accepts granted/unknown/withdrawn; granted requires evidence text; withdrawn records are not re-enabled by CSV import; an unknown import preserves an existing grant. Contact opt-out can be recorded by any organization member and adds a channel-specific suppression plus a restricted audit event.
- Dashboard script syntax and DOM-id consistency checks passed in the current repository snapshot. This is not a browser-to-Supabase integration test.

- Security increment: suppression rows are append-only for authenticated users; direct campaign status/dry-run updates are not permitted by the customer RLS policy. The opt-out route is available to any organization member and cannot grant permission.
- See `SECURITY_TEST_PLAN.md` for staging security tests and `SUPABASE_STAGING_SETUP.md` for staging project, owner provisioning and deployment steps. CI static/type/SQL checks are green on the current draft PR head; staging integration/RLS tests remain pending.
