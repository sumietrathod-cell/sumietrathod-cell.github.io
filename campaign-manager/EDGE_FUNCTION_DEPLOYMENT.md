# Supabase Edge Function deployment notes

The first authenticated API starter is at `supabase/functions/campaign-api/index.ts`.

## Routes
- `GET /functions/v1/campaign-api/me` — returns the authenticated user and memberships visible under RLS.
- `GET /functions/v1/campaign-api/campaigns?organization_id=<uuid>` — lists campaigns for a member organization.
- `POST /functions/v1/campaign-api/campaigns` — creates a draft campaign with `dry_run=true`.
- `GET /functions/v1/campaign-api/campaigns/{id}/contacts?limit=50&offset=0` — read-only, paginated contact workspace data (up to 100 rows), including channel permission status, evidence-present and suppression flags.
- `POST /functions/v1/campaign-api/campaigns/{id}/preview` — read-only eligibility preview. Checks permission status/evidence, suppression list, phone validity, campaign contact state and attempt cap; returns counts and up to 100 blocked examples. Maximum 4,999 contacts per request; never sends or queues outreach.
- `POST /functions/v1/campaign-api/campaigns/{id}/contacts/import` — imports a CSV payload as JSON (`{ "csv_text": "..." }`) into a draft voice/WhatsApp campaign. It accepts up to 500 rows and 1 MB; unknown consent remains unknown. No outreach is sent.

All requests require a Supabase Auth access token. The function uses the caller's JWT and anon key, so database operations remain subject to RLS. It deliberately does not use a service-role key.

## Staging deployment
1. Create a separate Supabase staging project; do not use production data.
2. Review and apply `campaign-manager/supabase/schema.sql`, then `campaign-manager/supabase/rls-policies.sql` in the staging SQL editor. If the original schema was already applied, review and apply `campaign-manager/supabase/migrations/20261117_tenant_integrity.sql` instead of assuming the revised schema file alters existing tables.
3. Run RLS tests with at least two organizations and separate users. Verify cross-tenant SELECT/INSERT/UPDATE/DELETE attempts fail.
4. Install the Supabase CLI and link the staging project locally.
5. From the repository root, run `supabase login` and `supabase link --project-ref <STAGING_PROJECT_REF>`.
6. Set the exact dashboard origin: `supabase secrets set APP_ORIGIN=https://<staging-dashboard-host>`. Supabase provides `SUPABASE_URL` and `SUPABASE_ANON_KEY` to Edge Functions. Do not set or expose a service-role key for this function.
7. Deploy with `supabase functions deploy campaign-api`.
8. Configure the dashboard to call `<SUPABASE_URL>/functions/v1/campaign-api` and send the current Supabase Auth access token as `Authorization: Bearer <token>`.
9. Create test users and provision organization memberships through a trusted admin process. There is intentionally no public self-join endpoint.
10. Test expired tokens, viewer-role writes, invalid UUIDs, oversized fields, cross-tenant access and CORS behavior.

## Current limitations
- This is an API starter, not a deployed service. No Supabase project is linked or configured by this repository change.
- The starter exposes authenticated `me`, campaign list/create, paginated campaign contact reads, CSV contact import and read-only campaign eligibility preview. It still does not schedule or send outreach.
- CORS is restricted to the exact `APP_ORIGIN`; requests without an Origin header are still protected by bearer-token authentication and database RLS.
- Organization provisioning/invitations, a connected frontend/contact UI, campaign approval, pause, opt-out, queue worker, provider webhooks, rate limits and automated tests are not implemented yet.
- Campaign creation always forces draft + dry-run. There is no route to activate outreach.
- Never add service-role keys or provider secrets to GitHub or browser code.

## Database integrity note
The revised schema adds composite foreign keys to enforce that linked contacts, campaigns, permissions, suppressions and attempts belong to the same organization. These are present for a fresh schema install. If an earlier schema has already been applied, prepare a reviewed migration rather than rerunning `CREATE TABLE IF NOT EXISTS` and assuming existing tables are altered.
