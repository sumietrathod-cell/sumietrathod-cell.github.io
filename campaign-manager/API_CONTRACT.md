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
| POST | /functions/v1/campaign-api/campaigns/{id}/contacts/import | Import CSV contacts into a draft dry-run campaign; channel permission defaults to unknown unless explicit granted status plus evidence are supplied |
| POST | /v1/campaigns/{id}/preview | Return eligible, blocked and invalid contact counts |
| POST | /v1/campaigns/{id}/approve | Explicitly approve a dry-run or live campaign |
| POST | /v1/campaigns/{id}/pause | Pause future jobs |
| GET | /v1/campaigns/{id}/events | Read outcomes and audit events |
| POST | /v1/contacts/{id}/opt-out | Add durable channel suppression |
| POST | /v1/webhooks/{provider} | Verify provider signature and process idempotently |

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
- `POST /functions/v1/campaign-api/campaigns`: create a draft with `dry_run=true`.
- `POST /functions/v1/campaign-api/campaigns/{id}/contacts/import`: accepts JSON `{ "csv_text": "..." }`; CSV headers must be `full_name,phone_e164,email,consent_status,consent_evidence`. Maximum 1 MB and 500 contact rows. Phone values must already be E.164 (for example, +14155550123); ambiguous/local numbers are rejected.
- The import endpoint only accepts voice or WhatsApp draft campaigns. It stores contacts and channel permission status. Only a row with `consent_status=granted` and non-empty evidence is recorded as granted; all other rows are recorded as unknown. A phone/email alone is never treated as consent.
- Import is not a transactional bulk operation yet: row-level failures are returned and partial writes may exist. Review results before proceeding. The endpoint does not send messages or place calls.
