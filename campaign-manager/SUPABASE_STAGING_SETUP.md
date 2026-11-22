# Supabase staging setup — AAROHAN AI Campaign Manager

This is a staging-only setup guide. No tenant schema has been deployed to production by these changes. The current AAROHAN production CRM already has `public.campaigns` with a different structure, so this schema cannot be safely applied there without a separately designed compatibility/migration plan.

## 1. Create a staging project
- Create a new Supabase project dedicated to staging; do not use production customer data.
- Save the Project URL and public anon key for the dashboard setup.
- Keep the database password, service-role key and provider secrets private. Never paste them into GitHub, this dashboard or chat.

## 2. Apply the database SQL
In the Supabase SQL Editor, review and run in this order:
1. **Run `campaign-manager/supabase/preflight.sql`. It must succeed** in a new dedicated staging database. If it reports existing core tables, stop; do not apply the schema in the old CRM database.
2. `campaign-manager/supabase/schema.sql`
3. `campaign-manager/supabase/rls-policies.sql`
4. Run the rollback-only `campaign-manager/supabase/tests/permission-guard.sql` test in staging.
5. If a dedicated staging project was previously seeded with an earlier version of this schema, do not reapply the new-install preflight; separately review `campaign-manager/supabase/migrations/20261117_tenant_integrity.sql` as an existing-install migration instead of relying on `CREATE TABLE IF NOT EXISTS`. Do not use the existing AAROHAN production project for this upgrade.

Do not run `campaign-manager/supabase/queue-worker.sql` for live scheduling. It is only a queue-claim foundation; there is no complete worker, stale-lock recovery, provider dispatch or callback handling.

## 3. Create the first owner membership
- Create or invite the intended owner in Supabase Authentication first.
- In the SQL Editor, review this one-time template. Replace the email and organization name before execution:

```sql
do $$
declare
  v_user_id uuid;
  v_org_id uuid;
begin
  select id into v_user_id
  from auth.users
  where lower(email) = lower('OWNER_EMAIL@example.com')
  limit 1;

  if v_user_id is null then
    raise exception 'No Auth user found for the supplied email. Create/invite the user first.';
  end if;

  insert into public.organizations (name)
  values ('AAROHAN AI WORLD - STAGING')
  returning id into v_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org_id, v_user_id, 'owner');

  raise notice 'Staging organization created: %', v_org_id;
end $$;
```

Run once only; it creates a new organization. Membership provisioning is intentionally not exposed as a public API.

## 4. Deploy the Edge Function
From the repository root on a trusted computer with the Supabase CLI:
```sh
supabase login
supabase link --project-ref YOUR_STAGING_PROJECT_REF
supabase secrets set APP_ORIGIN=https://YOUR_EXACT_DASHBOARD_ORIGIN
supabase functions deploy campaign-api
```

The project URL and anon key are supplied by Supabase to Edge Functions. The function uses the caller's JWT and anon key, not a service-role key.

The root `supabase/config.toml` intentionally sets `verify_jwt = false` so unauthenticated browser OPTIONS preflight requests reach the function. The function itself requires a valid Bearer token on every non-OPTIONS route using `auth.getUser()`. Do not remove that application-level validation.

## 5. Connect the dashboard
- Serve `campaign-manager-dashboard.html` from an HTTPS origin that you control.
- Enter the staging Project URL and public anon key in the dashboard.
- Sign in with the owner account provisioned above.
- Confirm the organization and test only with fictional contacts and non-deliverable test destinations.
- The exact dashboard origin must match `APP_ORIGIN` including scheme and hostname. Do not include a page path.

## 6. Validate before considering release
Follow `SECURITY_TEST_PLAN.md` with at least two organizations and separate users. Verify the GitHub Actions check is green and manually test RLS, opt-out, CSV validation, CORS, viewer permissions and cross-tenant access.

## Current hard boundary
There is no live outreach capability in this release. Campaigns are created as draft + dry-run. No voice/WhatsApp provider credentials, scheduler, dispatch worker, callback webhook, campaign approval route or production monitoring are configured. Do not switch campaigns to running/dry_run=false manually. Future live activation requires a separately reviewed approval/worker implementation, provider setup, legal compliance and explicit owner approval.
