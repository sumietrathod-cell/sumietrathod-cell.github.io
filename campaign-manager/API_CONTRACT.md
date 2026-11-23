# API and worker contract (implementation plan)

This contract is the boundary between the dashboard and the trusted backend. It is not a live API.

## Authentication and tenancy
- Supabase Auth access token required for all customer endpoints.
- Resolve organization membership on the server for every request; never trust organization_id supplied by the browser alone.
- Roles: owner, admin, operator, viewer. Viewer is read-only.
- Service-role credentials are server-only and never shipped to the browser.

## Endpoints
| Method | Path | Purpose |
|---|---|---|
| GET | /v1/me | Current user and permitted organizations |
| POST | /v1/organizations | Create organization and owner membership through trusted provisioning |
| GET/POST | /v1/campaigns | List/create campaigns |
| GET/PATCH | /v1/campaigns/{id} | Read/update campaign |
| POST | /functions/v1/campaign-api/contacts/{id}/opt-out | Record a channel-specific withdrawal, add suppression and append a self-attributed audit event |
| GET | /functions/v1/campaign-api/campaigns/{id}/contacts?limit=50&offset=0 | List paginated campaign contacts with permission and suppression flags (read-only) |
| POST | /functions/v1/campaign-api/campaigns/{id}/contacts/import | Import CSV contacts into a draft dry-run campaign with permission `unknown` or `withdrawn`; all CSV `granted` rows are rejected |
| POST | /v1/campaigns/{id}/preview | Return eligible, blocked and invalid contact counts |
| POST | /v1/campaigns/{id}/approve | Explicitly approve a dry-run or live campaign |
| POST | /v1/campaigns/{id}/pause | Pause future jobs |
| GET | /v1/campaigns/{id}/events | Read outcomes and audit events |
| POST | /v1/contacts/{id}/opt-out | Add durable channel suppression |
| POST | /v1/webhooks/{provider} | Verify provider signature and process idempotently |

### Duplicate numbers and opt-out precedence (staging draft)

The importer scans syntactically valid CSV `withdrawn` rows before writing. If a number also has an `unknown` row, **withdrawn wins**, regardless of CSV order. The unknown duplicate is rejected; an invalid or self-asserted `granted` row cannot consume the number's duplicate marker. A phone is only marked imported for this file after all requested database writes have succeeded. The scan is a precedence safeguard, **not** an independently verified opt-in or a transaction across all contacts. Opt-out records remain do-not-contact.

## Import validation
- Accept CSV only; enforce configurable byte, row and column limits.
- Normalize phone numbers to E.164 with an explicit country selection; reject ambiguous numbers.
- Validate email syntax, trim fields, reject spreadsheet formula payloads in exports.
- Never infer consent from a non-empty phone/email field.
- Require channel-specific permission evidence before a contact is eligible.
- Deduplicate within an organization; return row-level errors without leaking other tenants' records.

## Eligibility gate (must run immediately before every send)
1. Campaign is approved, active and not paused/cancelled.
2. Contact belongs to the same organization as the campaign.
3. Explicit permission exists for the selected channel and is not withdrawn.
4. Contact is not in the organization/channel suppression list and has not opted out.
5. Contact is not invalid, blocked, or already completed for this campaign.
6. Attempt count is below the configured maximum.
7. Current time is inside the contact's legally permitted local calling/messaging window.
8. Applicable provider, jurisdiction, registration, template and platform rules are satisfied.
If any check fails, mark skipped with a machine-readable reason. Fail closed on missing data.

## Queue/worker guarantees
- Durable queue in PostgreSQL; claim jobs atomically (e.g. FOR UPDATE SKIP LOCKED).
- Each attempt has an idempotency key; provider webhook events are deduplicated.
- Retry only transient failures with bounded exponential backoff and a hard attempt cap.
- Opt-out/pause/cancel checks happen again immediately before provider dispatch.
- Never log full message bodies, credentials, or unnecessary personal data.
- Provider callbacks are signature-verified; reject invalid signatures.

## Live activation checklist
- Staging Supabase project and migration review.
- RLS tests with two organizations and users in each; prove cross-tenant reads/writes fail.
- Auth, rate limits, CSRF/origin controls where applicable, secret management and audit logs.
- Provider business accounts, approved templates/scripts, verified webhooks and jurisdictional compliance.
- Consent evidence, suppression process, quiet hours and human escalation tested.
- Explicit owner approval for each live campaign. Default is dry-run.

## Implemented Edge Function starter (not deployed)
- `GET /functions/v1/campaign-api/me`: authenticated user and RLS-visible memberships.
- `GET /functions/v1/campaign-api/campaigns?organization_id=<uuid>`: list visible campaigns.
- `GET /functions/v1/campaign-api/campaigns/{id}/contacts?limit=50&offset=0`: list up to 100 campaign contacts per page with contact details, channel permission status, evidence-present flag and suppression flag. This route is read-only.
- `POST /functions/v1/campaign-api/contacts/{id}/opt-out`: accepts `{ "channel": "voice|whatsapp|email", "reason": "..." }`; inserts a suppression record, marks channel permission withdrawn and records a limited audit event. A failed later step never removes the already-inserted suppression.
- `POST /functions/v1/campaign-api/campaigns`: create a draft with `dry_run=true`.
- `POST /functions/v1/campaign-api/campaigns/{id}/contacts/import`: accepts JSON `{ "csv_text": "..." }`; CSV headers must be `full_name,phone_e164,email,consent_status,consent_evidence`. Maximum 1 MB and 500 contact rows. Phone values must already be E.164 (for example, +14155550123); ambiguous/local numbers are rejected.
- The import endpoint only accepts voice or WhatsApp draft campaigns. It stores contacts and channel permission status **only as unknown or withdrawn**. Any `consent_status=granted` is rejected regardless of the supplied evidence reference; a phone/email or self-asserted CSV field is never verified opt-in. Existing pre-recorded grants are not overwritten by an unknown import.
- Import is not a transactional bulk operation yet: row-level failures are returned and partial writes may exist. Review results before proceeding. The endpoint does not send messages or place calls.

## Tenant integrity hardening
- The schema now adds composite organization keys and composite foreign keys so campaign contacts, contact permissions, suppression entries and outreach attempts cannot point across organizations.
- These constraints are included in the schema for a fresh database. If the original schema was already applied, review and test `supabase/migrations/20261117_tenant_integrity.sql`; do not assume `CREATE TABLE IF NOT EXISTS` retrofits constraints.
- CSV evidence is self-reported and **cannot create a grant** through this API; existing historical grants remain subject to independent consent validation, provider rules and applicable law before any future live campaign.

## Read-only preflight preview (staging implementation)
- `POST /functions/v1/campaign-api/campaigns/{id}/preview` now fetches `campaigns.timezone/calling_window_start/calling_window_end`, `campaign_contacts.next_attempt_at`, and permission evidence `captured_at/captured_by` as well as status/reference.
- It uses a tested, deterministic evaluator to report blockers such as `permission_proof_incomplete`, `retry_not_due`, `calling_window_missing_or_invalid` and `outside_calling_window` rather than over-counting them as eligible.
- Preview is point-in-time and independent of a provider. Campaign activation is still not implemented; `campaign_state_allows_dispatch` is a status flag only and the endpoint explicitly returns `campaign_dispatch_ready=false` and `dispatch_enabled=false`.
- Tests: `deno test supabase/functions/campaign-api/preview-eligibility.test.ts` and `node scripts/check-campaign-dashboard.mjs`. No contact data is needed to run them.

## Repeat-safe opt-out endpoint (staging implementation)
- `POST /functions/v1/campaign-api/contacts/{id}/opt-out` now invokes ONE authenticated `public.record_campaign_contact_opt_out` RPC under member RLS; suppression, withdrawn permission and audit commit together. CSV importer alone uses retry-safe suppression `upsert`. First suppression reason and original permission evidence are preserved.
- A unique database index on `suppression_list(contact_id, channel)` is mandatory. An existing separate staging database must apply `supabase/migrations/20261123_suppression_idempotency.sql` and pass its duplicate-group preflight before the API is deployed.
- Opt-out is atomic only after the dedicated staging database installs `campaign-manager/supabase/opt-out-rpc.sql` and the suppression unique index before deploying its Edge API. An audit failure rolls back suppression and permission changes. CSV import remains non-transactional and may partially succeed. No sending is enabled.

## Opt-out audit integrity (staging SQL + HTTP verification)

- An authenticated `audit_events` insert claiming `contact_permission_withdrawn` is accepted only with the same signed-in actor, scoped contact, matching withdrawn permission and existing channel-specific opt-out suppression. The audit `details` keys are limited to `channel` and `source=campaign_manager_opt_out`.
- Audit history is still restricted to owner/admin reads. The opt-out Edge API no longer separately inserts audit events or attempts to SELECT audit rows; it invokes the atomic SQL RPC and returns a narrow success confirmation.
- The `SECURITY INVOKER` SQL RPC executes all three operations in one PostgreSQL transaction. An injected audit failure rolls back suppression and permission writes; this was verified with disposable PostgreSQL and JWT-backed HTTP, not production Supabase Auth.
- Verified only with synthetic PostgreSQL and signed JWT HTTP fixtures, not real Supabase Auth sessions. No actual provider or customer communication occurs.


## Opt-out and permission protections
- Any authenticated organization member may submit an opt-out. RLS only permits member opt-out writes to set permission status to `withdrawn`, add a channel-specific suppression record from this endpoint, and append a self-attributed `contact_permission_withdrawn` audit event.
- CSV import accepts `unknown` or `withdrawn` and explicitly rejects `granted` even with purported evidence. Existing withdrawn permission cannot be reinstated by CSV import. An unknown import leaves any historical grant and its original evidence untouched; only the trusted future verification path may add fresh grants.
- Suppression is checked separately from permission status and remains a block even if a permission row is later changed. Suppression records are not deleted by the customer API.
- Preview returns `campaign_dispatch_ready=false` in this release because no dispatch worker/provider adapter exists. `campaign_state_allows_dispatch` only describes the campaign status/dry-run fields. Contact-level `eligible` is not permission to dispatch.
