-- LOCAL GITHUB ACTIONS POSTGRES ONLY. Never run against live Supabase.
-- Stub the minimum Supabase Auth API so real tenant RLS can be verified in
-- a disposable PostgreSQL 17 service container.
create role authenticated nologin;
create role anon nologin;
-- Disposable emulation of Supabase's trusted service role. No login or keys.
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create or replace function auth.uid()
returns uuid language sql stable set search_path = '' as $$
  -- SQL integration checks use the legacy request.jwt.claim.sub GUC.
  -- Real PostgREST HTTP requests provide the JWT payload in claims JSON.
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid
$$;
create or replace function auth.jwt()
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
insert into auth.users(id) values
 ('00000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-000000000002');
grant usage on schema auth,public to authenticated,anon;
grant execute on function auth.uid(),auth.jwt() to authenticated,anon;
