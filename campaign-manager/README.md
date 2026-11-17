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
- [ ] Auth, tenant provisioning and RLS verification
- [x] API contract and CSV validation requirements drafted
- [ ] API implementation and CSV import validation
- [ ] Durable scheduler/worker and idempotency
- [ ] Callback and suppression workflows
- [ ] Provider adapters and webhook verification
- [ ] Automated tests, deployment and monitoring
- [ ] Security and compliance review before live use

## Security and API design notes
- `supabase/rls-policies.sql` adds fail-closed tenant membership policies; apply only in staging and test with multiple organizations.
- `API_CONTRACT.md` defines the required authenticated API, import validation, last-moment eligibility gate, queue guarantees and live activation checklist.
- The SQL policies are a draft, not a substitute for independent security review or integration tests.

## Local development (planned)
The backend framework and deployment target will be finalized before production implementation. Do not treat this prototype or schema draft as production-ready.
