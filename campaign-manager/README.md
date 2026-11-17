# AAROHAN AI Campaign Manager

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
- [x] Draft tenant-scoped RLS policies (staging validation still required)
- [ ] Auth, tenant provisioning and RLS verification (API starter added; staging validation pending)
- [x] API contract and CSV validation requirements drafted
- [x] Initial authenticated campaign API routes (me, list/create draft campaigns, paginated campaign contacts, guarded CSV import and read-only preview; staging deployment pending)\n- [x] CSV import endpoint starter (1 MB / 500-row limits; partial writes are reported; staging tests pending)\n- [x] Initial authenticated dashboard UI (connect, sign in, organizations, draft creation, CSV import, paginated contacts, eligibility preview; staging connection pending)
- [ ] Production-ready customer-facing contact management UI and staging validation
- [ ] Durable scheduler/worker and idempotency
- [ ] Callback and suppression workflows
- [ ] Provider adapters and webhook verification
- [ ] Automated tests, deployment and monitoring
- [ ] Security and compliance review before live use

## Security and API design notes
- `supabase/rls-policies.sql` adds fail-closed tenant membership policies; apply only in staging and test with multiple organizations.
- `API_CONTRACT.md` defines the required authenticated API, import validation, last-moment eligibility gate, queue guarantees and live activation checklist.\n- `supabase/functions/campaign-api/index.ts` is an initial JWT-verified, user-scoped Edge Function starter; it uses RLS, creates draft campaigns only, and imports contacts with channel permission evidence. It does not send outreach.\n- `EDGE_FUNCTION_DEPLOYMENT.md` documents staging setup and tests. The function has not been deployed.
- The SQL policies are a draft, not a substitute for independent security review or integration tests.

## Local development (planned)
The backend framework and deployment target will be finalized before production implementation. Do not treat this prototype or schema draft as production-ready.


## Browser demos
- Campaign overview and simulated outreach: `../campaign-manager-demo.html`
- Contact workspace (CSV import, permission review, filtering and export): `../campaign-contacts-demo.html`

Both pages are browser-only demonstrations. They do not connect to the database or send calls/messages.


## Latest backend increment
- Added authenticated read-only `POST /functions/v1/campaign-api/campaigns/{id}/preview` eligibility checks for voice/WhatsApp campaigns. It reports permission/evidence, suppression, invalid-contact, processed-status and attempt-limit blocks. It never dispatches outreach and is limited to 4,999 enrolled contacts per request.

- Latest API increment: paginated `GET /campaigns/{id}/contacts` now returns campaign contact details plus channel permission/evidence-present and suppression flags. Composite organization foreign keys were added to the fresh-install schema to reduce cross-tenant reference risks. Staging validation and any required migration for an already-existing database remain outstanding.
