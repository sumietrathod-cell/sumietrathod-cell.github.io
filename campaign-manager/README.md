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
- [x] Disposable PostgreSQL 17 CI integration checks (2 synthetic tenants, real RLS, permission guard, queue SQL; not actual Supabase Auth E2E)
- [ ] Authenticated staging integration/RLS tests with actual Supabase users, deployment and monitoring
- [ ] Security and compliance review before live use

## Security and API design notes
- `supabase/rls-policies.sql` adds fail-closed tenant membership policies; apply only in staging and test with multiple organizations.
- `API_CONTRACT.md` defines the required authenticated API, import validation, last-moment eligibility gate, queue guarantees and live activation checklist.\n- `supabase/functions/campaign-api/index.ts` is an initial JWT-verified, user-scoped Edge Function starter; it uses RLS, creates draft campaigns only, and imports contacts with channel permission evidence. It does not send outreach.\n- `EDGE_FUNCTION_DEPLOYMENT.md` documents staging setup and tests. The function has not been deployed.
- The SQL policies are a draft, not a substitute for independent security review or integration tests.


## Campaign preflight preview parity (staging draft)
- The read-only Edge Function preview now uses `supabase/functions/campaign-api/preview-eligibility.ts` to cross-check phone validity, recorded channel consent, evidence reference, evidence actor/timestamp (not future), opt-out/suppression, terminal outcomes, retry due time, attempt cap and the **currently configured campaign-local calling window**.
- Missing windows, unsupported/invalid time zones, missing proof metadata and future/unset callbacks fail closed. Preview counts distinguish incomplete proof, callback not yet due, invalid window and outside calling hours. The API does not queue or send anything.
- `preview-eligibility.test.ts` exercises 30 synthetic cases, and GitHub Actions runs these with `deno test`. Dashboard regression checks ensure the Edge Function actually selects the required consent date/actor and due-time fields and invokes the tested gate.
- The campaign's `status` and `dry_run` still determine whether the **underlying campaign state** would permit dispatch; `campaign_dispatch_ready` and `dispatch_enabled` stay **false** in this staging release. A passing contact preflight is not legal consent verification, provider approval, actual delivery or a production go-live claim.

## Outbound eligibility safety (staging draft)
- `claim_due_campaign_jobs` now requires a **real non-empty consent evidence reference**, a non-future `captured_at` timestamp and a `captured_by` actor before considering any voice/WhatsApp job.
- Campaigns must configure **both** calling-window times, with `start < end`. Missing windows and overnight ranges now **fail closed**; an absent window is **not** treated as 24/7 authorization.
- All existing checks still require an active non-dry-run campaign, a queued eligible enrollment, valid E.164 phone, non-suppressed channel, and bounded attempt count.
- Queued **first** attempts can be unscheduled, but `callback` and `no_answer` follow-ups must have an explicit `next_attempt_at` that is already due. A future or unset callback date cannot be claimed early.
- `campaign_jobs` has a unique partial index on `(organization_id,campaign_contact_id)` while `status IN ('queued','processing')`. Two simultaneous pending jobs for the same contact are rejected even when they have different idempotency keys; a completed job no longer occupies the active slot.
- Real PostgreSQL CI now includes `supabase/tests/queue-active-uniqueness-ci.sql` to assert the partial index, plus an expanded 14-case synthetic eligibility test (2 allowed, 12 blocked). This does not guarantee exactly-once external delivery: reconciliation and provider idempotency remain pending.
- Verified in `supabase/tests/queue-claim-eligibility.sql` using 11 synthetic jobs and the same proposed claim function translated to temporary tables. One eligible job was claimed; all other jobs stayed queued. The whole transaction rolled back.
- **No outbound provider is connected, no job worker is scheduled, and no contact was messaged.** An explicit calling window is not sufficient for legal compliance; a future provider must recheck the actual recipient's time zone, jurisdiction, opt-out, consent and platform restrictions immediately before each send.

## Stale outbound job safety (staging draft)
- `campaign-manager/supabase/queue-worker.sql` contains a **service-role-only** `quarantine_stale_campaign_jobs` function to isolate claims whose processing lease is stale.
- Quarantine marks old processing jobs as `failed` with `stale_claim_needs_manual_review`, clears lock metadata, and **never requeues or sends**. A worker crash may occur *after* a provider accepted an outbound message, so automatic retry could duplicate it.
- The routine is **not scheduled**, and the campaign worker/provider dispatch system is **not live**. Before any customer release, reconcile each stale claim against provider receipts, build safe audited reconciliation, and verify exactly-once outcomes with real providers.
- A synthetic PostgreSQL transaction test is stored at `campaign-manager/supabase/tests/queue-quarantine.sql`; it uses only temporary data and ends with ROLLBACK. `scripts/check-campaign-queue.mjs` verifies that the test's function source matches the proposed implementation and that authenticated users cannot execute it.

## Repeat-safe opt-outs and CSV withdrawals (staging draft)
- A **unique contact/channel suppression index** in `supabase/schema.sql` prevents duplicate suppression records for the same contact and channel, while allowing separate voice, WhatsApp and email suppression and phone-only blocks.
- The contact opt-out route and draft CSV withdrawal importer both write with `upsert(..., {onConflict: "contact_id,channel", ignoreDuplicates:true})`. A retried request is accepted without overwriting the original suppression reason/source; the permission-withdrawal step still runs after the suppression write.
- GitHub CI uses `supabase/tests/tenant-suppression-idempotency-ci.sql` with fictional two-tenant RLS fixtures to test repeated requests, viewer vs operator roles and cross-tenant rejection. All changes roll back.
- For an **existing dedicated multi-tenant staging install**, first review and run `supabase/migrations/20261123_suppression_idempotency.sql`. It **refuses** to proceed if existing contact/channel duplicates are present; resolve them by an authorized manual data review, never automatically delete consent/suppression records. The Edge Function `upsert` requires the unique index to exist first.
- Opt-out flow still uses multiple database requests, not a single atomic transaction; a later permission/audit error can leave suppression saved and requires review. This is **not** evidence of real-world deployment or 100% readiness.

## Consent/opt-out policy hardening (staging draft)
- The contact-channel permission operator policy is split into INSERT and UPDATE. Direct authenticated DELETE access is deliberately not provided.
- Database trigger `public.guard_contact_channel_permission()` prohibits changing tenant/contact/channel IDs, reinstalling previously withdrawn permission via UPDATE, or granting permission without evidence reference, actor and timestamp.
- A local-equivalent synthetic temporary-table SQL transaction passed 5 scenarios; the actual staging policy and multi-tenant user flows still require independent E2E verification.
- Re-run the `campaign-manager/supabase/tests/permission-guard.sql` rollback test **in dedicated staging**, not against the old production CRM.
- Granting permission still requires an independent operator review that evidence is legitimate. Neither a database guard nor a CSV string independently proves consent.

## Consent and campaign history retention (staging draft)

- The new-install schema now uses `ON DELETE RESTRICT` on contact permissions, campaign enrollments and outreach-attempt foreign keys. Owner-level deletion of a contact must not silently cascade-delete recorded opt-outs/consent, and deleting an enrolled campaign must not erase contact activity or attempt history.
- Deleting a **truly unlinked** contact or an empty draft campaign remains permitted under the relevant owner/admin RLS policy.
- `supabase/tests/tenant-history-retention-ci.sql` tests both allowed cleanup and rejected destructive parent deletes using actual PostgreSQL foreign-key behavior in a disposable database. The whole test transaction rolls back. [CI validation](https://github.com/sumietrathod-cell/sumietrathod-cell.github.io/actions/runs/45101251060) passed both jobs.
- This rule is a history-integrity safeguard, **not** a completed data-retention or right-to-erasure workflow. Future deletion/anonymization requests require a documented authorized process considering consent evidence, suppression records, lawful retention, and applicable privacy laws.
- **Existing deployed databases will NOT change by re-running `CREATE TABLE IF NOT EXISTS`**. A separately reviewed migration is necessary if this policy is adopted in a real staging database. Never apply this draft to the legacy production CRM.

## Consent-to-phone binding (staging draft)

- The `public.guard_campaign_contact_identity()` BEFORE UPDATE trigger prevents reassigning a contact's `id` or `organization_id`.
- An operator may correct `phone_e164` **before** the contact has any channel-permission or campaign-enrollment row. Once permission is recorded or the contact is enrolled, the phone becomes immutable so consent for one number cannot be reused to message a different number.
- Normal name edits remain permitted. A genuine number change after consent requires a separately created contact and freshly verified, channel-specific permission; never transfer old evidence or clear an opt-out to make it work.
- The real PostgreSQL CI test `supabase/tests/tenant-contact-identity-ci.sql` verifies editable pre-consent phone, allowed name update, denied post-consent and enrolled phone edits, immutable tenant/contact keys and denied cross-tenant changes.
- This is draft RLS/trigger code tested only in disposable PostgreSQL. It has **not** been applied to the existing live AAROHAN CRM or tested using two signed-in staging Supabase accounts.

## Client-side campaign enrollment control (staging only)

- Replaced the broad authenticated `campaign_contacts FOR ALL` RLS rule with **INSERT-only** enrollment into the current organization's **draft, dry-run** campaign. New rows must start `queued`, with 0 attempts and no existing outcome or callback date.
- Authenticated organization users cannot directly UPDATE or DELETE campaign enrollment rows, manufacture completed/reached outcomes, reset attempts, or enroll into running campaigns. Future state updates belong to audited trusted workers.
- Disposable PostgreSQL CI `supabase/tests/tenant-enrollment-ci.sql` verifies allowed draft enrollment and blocked outcome/attempt forgery, running-campaign enrollment, cross-tenant enrollment, UPDATE and DELETE.
- This has **not** been deployed to the AAROHAN production CRM. It is a multi-tenant staging draft with a different schema. Provider integration, real Supabase Auth staging and REST API end-to-end validation are still mandatory.

## Audit event integrity hardening (staging draft)

- In `rls-policies.sql`, authenticated contact opt-out audit creation is now **bound to existing facts**: a self-attributed actor, same-organization contact, `contact_permission_withdrawn` event with exact `contact` type, matching `contact_channel_permissions` status `withdrawn`, and a matching durable `campaign_manager_opt_out` suppression for that channel. The `details` JSON is strictly restricted to the approved source and channel fields.
- This blocks forged audit events for another customer/tenant, unsupported channel, false completion type, other actor or arbitrary extra JSON. Authenticated users **cannot read audit history** (admin select only); insertion is intentionally write-only.
- New `tenant-audit-integrity-ci.sql` tests owner/operator and viewer scenarios with actual PostgreSQL RLS and rollback. `scripts/check-campaign-postgrest.mjs` additionally uses test JWTs to verify valid write-only audit insertion and six forbidden HTTP variants, including suppression without permission withdrawal.
- GitHub Actions now waits for a healthy PostgREST **schema cache**, not merely a live TCP/HTTP endpoint, to avoid flakiness from temporary `503 PGRST002`.
- Both jobs passed on [the tested commit](https://github.com/sumietrathod-cell/sumietrathod-cell.github.io/actions/runs/45105015141). These are **disposable synthetic CI** checks, not evidence of a real deployed Supabase Auth/Edge integration or of genuine lawful customer opt-outs.


## Authenticated HTTP/RLS integration (disposable CI only)

- The GitHub workflow now launches **PostgREST v14.18** against the same **ephemeral PostgreSQL 17** fixture used for policy checks. A fresh signing key is generated per workflow run; no real Supabase secrets, customer accounts or provider APIs are involved.
- `supabase/tests/ci-rest-fixtures.sql` seeds fictional Alpha (operator) and Beta (viewer) tenants. `scripts/check-campaign-postgrest.mjs` submits actual HTTP requests signed with synthetic short-lived JWTs. The suite passed **19 HTTP assertions**: anonymous denial, per-organization contact/campaign visibility, viewer write restrictions, cross-tenant creation refusal, draft-only campaigns, immutable enrollment outcomes, consent evidence and opt-out reversal enforcement, and idempotent suppression.
- The stub `auth.uid()` accepts the JWT claims JSON passed by PostgREST, while continuing to support SQL-only test fixtures. CI tears down PostgREST and the PostgreSQL service after each run. [Verified Actions run](https://github.com/sumietrathod-cell/sumietrathod-cell.github.io/actions/runs/45102837669) passed all jobs.
- **Limits:** These are genuine JWT-backed **PostgREST + PostgreSQL** tests, **not real Supabase Auth users/sessions, deployed Edge Function behavior, provider messaging or production data**. A separate authorized Supabase staging project with two genuinely signed-in test users remains mandatory before merging or publishing.


## Disposable PostgreSQL integration tests

The `tenant-rls-integration` job in `.github/workflows/campaign-manager-check.yml` boots an ephemeral PostgreSQL 17 container. It installs the **actual** draft schema, tenant RLS policies and queue SQL, with synthetic Auth role/function stubs in `supabase/tests/ci-auth-bootstrap.sql`. The following rollback-only tests run with `psql -v ON_ERROR_STOP=1`:

- `supabase/tests/campaign-access.sql`: cross-organization campaign isolation, draft-only creation, viewer permissions, and inability to activate directly.
- `supabase/tests/tenant-permissions-ci.sql`: separate operator/viewer organizations, row isolation, refusal to grant permission without evidence, irreversible opt-out, prohibited direct deletion, and denied cross-tenant updates.
- `supabase/tests/queue-claim-eligibility.sql`: eligible vs blocked synthetic outbound claims, without sending.
- `supabase/tests/queue-quarantine.sql`: safe stale-claim isolation without repeat sending.

**Limits:** This proves policies execute correctly on disposable PostgreSQL, not real Supabase Auth token lifecycle, app/integration correctness, recipient consent legitimacy or multi-customer production readiness. It does not create a real staging organization, configure the provider, merge the pull request, apply the new schema to the legacy production database, or send any messages. A dedicated staging project and two genuine authorized test users remain required.

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
