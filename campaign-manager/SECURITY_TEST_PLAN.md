# Campaign Manager staging security test plan

Do not run against production data. Use a fresh Supabase staging project and two separate test organizations.

## Before testing
- Review `supabase/schema.sql`.
- Apply `supabase/rls-policies.sql` after the schema.
- If the original schema was previously installed, review and apply `supabase/migrations/20261117_tenant_integrity.sql` first.
- Create two organizations (Org A and Org B), an owner/admin/operator/viewer in each, and at least one contact and campaign per organization.
- Provision memberships through a trusted administrator process. Never add a public self-join policy.
- Deploy the Edge Function to staging and set `APP_ORIGIN` to the exact dashboard origin.
- Use synthetic contact data only.

## Automated real PostgreSQL tenant RLS checks (disposable CI only)

The `tenant-rls-integration` workflow job spins up a short-lived PostgreSQL 17 service; no Supabase/project secrets or real contacts are used. It runs the actual schema, RLS policies and queue SQL with Auth helper emulation, then all four rollback-only SQL test suites in `supabase/tests/`. The test roles use synthetic Auth UUIDs; failures stop CI. This is stronger than syntax checks but **not** a substitute for actual signed-in Supabase / REST / Edge Function tests with two separate customer tenants.

## Authenticated opt-out audit integrity

- An authenticated audit append must be allowed only after recorded permission status is `withdrawn` and a matching `campaign_manager_opt_out` suppression exists in the same organization for the same contact and channel.
- A contact opt-out event may only name its actual actor, `entity_type='contact'`, `event_type='contact_permission_withdrawn'`, and `details={channel,source}` using an approved channel/source. Other tenant, false entity type, unsuppressed channel, forged actor and extra keys must all fail.
- Appending the event should succeed **without a SELECT/RETURNING projection**; ordinary members cannot read `audit_events`. Test persisted row counts after restoring trusted CI database role, not via client RLS.
- Verify with `tenant-audit-integrity-ci.sql` and the HTTP JWT checks in `scripts/check-campaign-postgrest.mjs`. A valid audit still does **not** prove the underlying consent claim was independently verified.
- Readiness polling must not interpret `503 PGRST002` (schema cache initializing) as successful HTTP startup. Follow the explicit status-based retry logic in CI.


## Disposable PostgREST JWT + RLS HTTP test (completed in CI)

- Spin up a disposable PostgreSQL 17 service plus pinned PostgREST 14.18; generate a unique test-only HMAC secret each run, never use a production token or service role in the HTTP client.
- Seed the fictional Alpha operator and Beta viewer fixtures in `supabase/tests/ci-rest-fixtures.sql`. Run `node scripts/check-campaign-postgrest.mjs` and fail CI on unexpected 2xx, RLS leakage, or forbidden writes.
- 19 synthetic HTTP assertions cover anonymous denial, cross-tenant list visibility, viewer/operator permissions, draft-only creation, campaign enrollment immutability, consent proof guard, opt-out reversal and channel suppression replay. [CI run](https://github.com/sumietrathod-cell/sumietrathod-cell.github.io/actions/runs/45102837669) passed.
- **Still required:** Repeat with *actual Supabase Auth* identities, browser login/logout, PostgREST and Edge Function deployment to a **dedicated staging** project, authorized owners and genuine API keys. The disposable test does not prove those integrations or authorization revocation/session behavior.


## Authentication and tenant isolation
- Missing bearer token returns 401.
- Expired or invalid token returns 401.
- Org A user can see only Org A memberships, campaigns, contacts, permissions and suppression rows.
- Org A user cannot read Org B campaign/contact IDs by changing URL path or query parameters.
- Org A user cannot create a campaign in Org B by changing `organization_id`.
- Viewer can read but cannot create campaigns or import contacts.
- Operator can create draft campaigns and import contacts only in their own organization.
- Membership records cannot be inserted, updated or deleted by authenticated users.
- Cross-organization composite foreign-key inserts fail even when a caller has a valid membership in one of the organizations.

## Parent deletion and consent-history integrity

- Direct owner/admin deletion of a contact with ANY channel permission must fail; no cascade may erase withdrawn consent, evidence or associated audit context.
- Deletion of an enrolled contact or campaign must fail while campaign history is linked. Check that draft campaigns with no enrollments and unlinked contacts may still be deleted when authorized.
- Verify this with the disposable PostgreSQL `supabase/tests/tenant-history-retention-ci.sql` test and separately in real staging before any release.
- **Important:** parent organization deletion and legal data-erasure obligations are not handled by these FK constraints alone. Design separate authenticated approvals, retention schedule, suppression continuity and privacy-safe erasure procedures.
- Existing-install migration must be reviewed; the fresh-install schema policy does not automatically retrofit an earlier database.

## Contact identity / consent binding

- Before recording permission, an operator can correct a contact's phone; after permission or campaign enrollment, changing or clearing the phone must fail. A fresh phone number requires a distinct contact with its own consent and suppression checks.
- A contact's primary key and organization must be immutable, even if the operator belongs to two organizations. Changing a contact name without changing its identity remains permitted.
- Authenticated users cannot reassign an existing consent proof to a different recipient by editing `contacts.phone_e164`; they also cannot delete channel-permission history or enrolled-contact rows under existing RLS.
- The GitHub disposable PostgreSQL CI executes `supabase/tests/tenant-contact-identity-ci.sql` with separate fictional orgs/users, using the real SQL trigger and role policies. Retest with actual Supabase Auth users in a separate staging project before any release.

## Enrollment integrity and trusted state updates

- An operator may INSERT a `campaign_contacts` row only in a draft, dry-run campaign of their own organization. Initial status must be `queued`, attempts `0`, and outcome/callback date null.
- Signed-in users cannot directly UPDATE or DELETE `campaign_contacts` to forge a successful outcome, erase history, reset attempt counts or move an enrollment across tenants.
- The disposable PostgreSQL 17 CI job runs `supabase/tests/tenant-enrollment-ci.sql` with actual RLS enforcement using synthetic Auth identities.
- Confirm the Supabase Edge Function's `upsert(...ignoreDuplicates:true)` enrollment import in a genuine authenticated staging environment. A green SQL test alone does not prove the deployed REST client works end-to-end.

## Campaign state safety
- Campaign creation always stores `status=draft` and `dry_run=true`, regardless of client-supplied values.
- Authenticated users cannot update campaign `status` or `dry_run` directly through the Supabase REST API.
- Preview is read-only, always returns `dispatch_enabled=false` and `campaign_dispatch_ready=false`; `campaign_state_allows_dispatch` only describes campaign status/dry-run fields.
- `campaign_dispatch_ready` is false for draft, paused, completed, cancelled and dry-run campaigns.
- No endpoint in this starter schedules, queues or dispatches calls/messages.

## Same-file duplicate consent and withdrawal precedence

- When a CSV contains the same syntactically valid E.164 number as **unknown** and **withdrawn**, import the valid withdrawal and reject the other row, regardless of order. A later withdrawal must never be dismissed merely because an earlier unknown row appeared first.
- Rejected fabricated `granted` rows, invalid rows and failed database writes must not consume the duplicate-phone marker. Only a fully successful contact + permission/suppression + enrollment path marks the number seen.
- `supabase/functions/campaign-api/csv-import-policy.test.ts` tests six synthetic cases: withdrawal before/after unknown, unverified grant refusal, malformed withdrawal exclusions, case/whitespace normalization, and duplicate collapse. Real Supabase staging with two Auth users remains necessary.
- CSV import still spans multiple database requests. A later failed suppression/enrollment can leave partial data: do not enable delivery based on these import-only safety tests.

## CSV and permission safety
- Reject payloads over 1.1 MB and CSV text over 1 MB UTF-8.
- Reject more than 500 contact rows, missing/duplicate headers, malformed quotes, invalid E.164 phones, invalid email, extra columns and overlong fields.
- A phone/email alone never grants permission.
- CSV rows with `granted` are rejected even if they include a plausible evidence reference. Direct authenticated INSERT/UPDATE to a granted permission must also fail. A future independent proof-verification channel is required to grant consent.
- `unknown` never becomes granted.
- An unknown import does not overwrite a previously granted permission/evidence.
- A CSV import cannot reinstate a previously withdrawn permission.
- `withdrawn` sets channel permission to withdrawn and inserts a suppression record.
- Repeated import of the same contact does not create duplicate campaign enrollment.
- Review and document partial-write behavior: the import is not yet transactional.

## Atomic opt-out RPC and rollback tests (staging only)
- `supabase/opt-out-rpc.sql` must be installed after the tenant RLS policies and suppression unique index, before deploying the updated Edge API. Do not use this incompatible draft in production.
- `tests/tenant-opt-out-atomic-ci.sql` verifies member-only access, revoked anonymous access, invalid channel rejection, preservation of prior consent evidence, idempotent suppression and compatibility with an earlier CSV withdrawal.
- Its synthetic audit trigger intentionally raises an exception on the THIRD write. The PostgreSQL test checks that the first two writes leave NO partial suppression or permission. The separate signed-JWT PostgREST HTTP test verifies success and tenant isolation.
- Green disposable CI does not replace staging Supabase Auth/Edge HTTPS validation, legal compliance or approved provider delivery.

## Idempotent contact-channel suppression tests
- A viewer belonging to a tenant can add a channel-specific opt-out; a repeated identical opt-out must succeed without a second suppression row and without replacing the first recorded reason/source.
- Different channels remain distinct; a viewer must not gain the operator-only CSV withdrawal insert permission or modify a second tenant's suppression.
- An operator's repeated CSV withdrawal must leave one suppression entry. A raw duplicate INSERT without conflict handling must fail on the unique contact/channel index.
- The real disposable PostgreSQL suite `supabase/tests/tenant-suppression-idempotency-ci.sql` covers these cases. Validate PostgREST `upsert(ignoreDuplicates)` separately with genuine staging Auth tokens.
- Existing staging installs must run the fail-closed `supabase/migrations/20261123_suppression_idempotency.sql` before deploying the matching API change. Stop if the migration discovers duplicate contact/channel groups, and do not delete old suppressions automatically.

## Opt-out and suppression
- Any authenticated organization member can opt out a contact on voice, WhatsApp or email.
- Opt-out writes a suppression row, sets permission to withdrawn and attempts to append a self-attributed audit event.
- Viewer-role opt-out is allowed because it only restricts future contact; it cannot grant permission.
- Authenticated users cannot update or delete suppression rows.
- Deleting a contact with a suppression record is rejected so the do-not-contact history cannot disappear; organization-level deletion is a separate administrative action.
- If the permission/audit write fails after suppression succeeds, the API reports partial success and suppression remains active.
- Preview blocks contacts present in suppression list, even if another permission record appears granted.

## CORS and request handling
- Exact configured `APP_ORIGIN` succeeds.
- A different Origin receives 403.
- OPTIONS preflight returns 204 and only allows GET/POST.
- Unsupported HTTP methods receive 405.
- Invalid UUIDs and invalid JSON receive 400.
- Server configuration errors do not disclose secrets.
- Browser code contains only the Supabase public anon key supplied at runtime; no service-role or provider secret appears in repository history.

## Read-only API preview / queue consistency tests
- The read-only campaign preview must retrieve recorded permission actor and date (not just `evidence_reference`), and must reject missing, malformed or future timestamp evidence.
- Preview only reports an eligible contact when a valid local campaign window is currently open, relevant callback is actually due, channel permission is recorded with complete metadata, contact has not opted out, phone is valid and attempts remain available.
- A missing/invalid timezone or absent/overnight calling window must fail closed; local time checks use the configured IANA timezone rather than the browser time zone.
- Run all 30 synthetic cases in `supabase/functions/campaign-api/preview-eligibility.test.ts`. The `scripts/check-campaign-dashboard.mjs` assertion prevents accidentally dropping the required API projections/preview helper call.
- `campaign_dispatch_ready=false` and `dispatch_enabled=false` remain mandatory. Even a successful preflight does NOT authorize customer outreach; true consent/proof review and recipient-specific jurisdiction/provider restrictions remain separate release checks.

## Outbound claim eligibility tests
- Block jobs with a missing or equal/overnight calling window; do not default to all-day permission.
- Require nonempty consent evidence, an identified actor and a captured timestamp that is not in the future.
- Keep withdrawn/unknown/no-permission and explicitly suppressed contacts in queued/not-sent state.
- Ensure valid campaign is active, not dry-run, and contact/attempt counts are eligible.
- Run `supabase/tests/queue-claim-eligibility.sql` **only in a designated non-production simulation**; it uses synthetic temporary tables and rolls back. Test uses the same staged claim implementation with temporary-schema names.
- Recheck all these controls immediately before real provider dispatch. Explicit window still needs recipient-specific legal quiet-hour review.

## Retry timing and duplicate-job prevention
- A callback/no-answer enrollment with a missing or future `next_attempt_at` **cannot** be claimed, even when a separate job `available_at` is due.
- A callback/no-answer that is explicitly due **can** be claimed if all other consent/window checks pass.
- The real database unique partial index rejects two queued/processing jobs for the same enrollment, regardless of distinct idempotency keys; it blocks a queued insert while a job is processing and blocks concurrent active status transitions.
- After a job is genuinely completed, the active index slot can be reused, but the dispatcher must still enforce max attempts, consent, quiet hours, deduplication against provider results, and manual stale-claim reconciliation.
- CI uses real PostgreSQL for `supabase/tests/queue-active-uniqueness-ci.sql` and a 14-case temporary-table eligibility simulation; this remains separate from a genuine signed-in Supabase staging E2E test.

## Stale claim reconciliation tests
- A processing job older than the configured timeout is quarantined as failed, never queued again automatically.
- A fresh processing job, a queued job, a completed job, or a processing job without locked_at are not altered.
- Re-running quarantine after a successful pass changes zero further jobs; attempt counts are preserved.
- Invalid timeout/batch sizes fail closed; only service_role may execute the routine, never anon or authenticated.
- Check delivery receipts manually before changing the job; **no automatic retry of a quarantined claim**.
- `supabase/tests/queue-quarantine.sql` tests a temporary synthetic queue transaction and rolls back; it is not proof of production provider behavior.

## Release gate
Do not merge to `main`, publish to the public website, activate providers, or send live outreach until:
1. CI type-check and dashboard static checks pass.
2. All tests above pass with two organizations.
3. A reviewer inspects RLS, SQL migration and Edge Function behavior.
4. Provider, jurisdiction, registration, template and consent requirements are verified.
5. A named organization owner explicitly approves a specific live campaign.

Current status: staging deployment and live database tests have not been run. This plan is a test checklist, not proof that the checks passed.
