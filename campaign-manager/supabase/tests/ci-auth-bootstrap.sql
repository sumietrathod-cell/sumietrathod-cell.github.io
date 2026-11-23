-- LOCAL GITHUB ACTIONS POSTGRES ONLY. Never run against live Supabase.
-- Stub the minimum Supabase Auth API so real tenant RLS can be verified in
-- a disposable PostgreSQL 17 service container.
create role authenticated nologin;
create role anon nologin;
create schema auth;
create table auth.users (id uuid primary key);
create or replace function auth.uid()
returns uuid language sql stable set search_path = '' as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create or replace function auth.jwt()
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
insert into auth.users(id) values
 ('00000000-0000-4000-8000-000000000001'),
 ('00000000-0000-4000-8000-000000000002');
grant usage on schema auth,public to authenticated,anon;
grant execute on function auth.uid(),auth.jwt() to authenticated,anon;
