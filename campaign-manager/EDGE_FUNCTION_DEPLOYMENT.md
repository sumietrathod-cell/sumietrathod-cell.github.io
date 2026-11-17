# Supabase Edge Function deployment notes

The first authenticated API starter is at `supabase/functions/campaign-api/index.ts`.

## Routes
- `GET /functions/v1/campaign-api/me` — returns the authenticated user and memberships visible under RLS.
- `GET /functions/v1/campaign-api/campaigns?organization_id=<uuid>` — lists campaigns for a member organization.
- `POST /functions/v1/campaign-api/campaigns` — creates a draft campaign with `dry_run=true`.

All requests require a Supabase Auth access token. The function uses the caller's JWT and anon key, so database operations remain subject to RLS. It deliberately does not use a service-role key.

## Staging deployment
1. Create a separate Supabase staging project; do not use production data.
2. Review and apply `campaign-manager/supabase/schema.sql`, then `campaign-manager/supabase/rls-policies.sql` in the staging SQL editor.
3. Run RLS tests with at least two organizations and separate users. Verify cross-tenant SELECT/INSERT/UPDATE/DELETE attempts fail.
4. Install the Supabase CLI and link the staging project locally.
5. Set the function secret `APP_ORIGIN` to the exact dashboard origin. Supabase provides `SUPABASE_URL` and `SUPABASE_ANON_KEY` to Edge Functions.
6. Deploy with `supabase functions deploy campaign-api`.
7. Create test users and provision organization memberships through a trusted admin process. There is intentionally no public self-join endpoint.
8. Test expired tokens, viewer-role writes, invalid UUIDs, oversized fields, cross-tenant access and CORS behavior.

## Current limitations
- This is an API starter, not a deployed service. No Supabase project is linked or configured by this repository change.
- Organization provisioning/invitations, contact import, campaign preview/approval, pause, opt-out, queue worker, provider webhooks, rate limits and automated tests are not implemented yet.
- Campaign creation always forces draft + dry-run. There is no route to activate outreach.
- Never add service-role keys or provider secrets to GitHub or browser code.
