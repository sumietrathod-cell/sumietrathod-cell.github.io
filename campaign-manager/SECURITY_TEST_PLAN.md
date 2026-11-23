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

## CSV and permission safety
- Reject payloads over 1.1 MB and CSV text over 1 MB UTF-8.
- Reject more than 500 contact rows, missing/duplicate headers, malformed quotes, invalid E.164 phones, invalid email, extra columns and overlong fields.
- A phone/email alone never grants permission.
- `granted` requires non-empty evidence text; the operator must separately verify that evidence is lawful and genuine.
- `unknown` never becomes granted.
- An unknown import does not overwrite a previously granted permission/evidence.
- A CSV import cannot reinstate a previously withdrawn permission.
- `withdrawn` sets channel permission to withdrawn and inserts a suppression record.
- Repeated import of the same contact does not create duplicate campaign enrollment.
- Review and document partial-write behavior: the import is not yet transactional.

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
