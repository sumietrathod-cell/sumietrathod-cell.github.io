create unique index campaign_leads_email_identity_idx on public.leads (lower(btrim(email)))
where nullif(btrim(email), '') is not null;

create unique index campaign_leads_phone_identity_idx on public.leads (regexp_replace(phone, '[^0-9]', '', 'g'))
where nullif(regexp_replace(phone, '[^0-9]', '', 'g'), '') is not null;

create unique index campaign_leads_name_identity_idx
on public.leads (lower(btrim(name)), coalesce(lower(btrim(company)), ''), coalesce(lower(btrim(country)), ''))
where nullif(btrim(email), '') is null and nullif(regexp_replace(phone, '[^0-9]', '', 'g'), '') is null;

create function public.campaign_import_leads(entries jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  inserted_count integer;
  entry_count integer;
begin
  if (select auth.uid()) is null or
     (select auth.jwt() -> 'app_metadata' ->> 'campaign_manager_role') is distinct from 'admin' then
    raise exception 'Campaign Manager admin access required' using errcode = '42501';
  end if;

  if jsonb_typeof(entries) is distinct from 'array' then
    raise exception 'Expected an array of leads' using errcode = '22023';
  end if;

  entry_count := jsonb_array_length(entries);
  if entry_count not between 1 and 500 or octet_length(entries::text) > 1048576 then
    raise exception 'Provide 1 to 500 leads in a batch up to 1 MB' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(entries) as entry(name text, email text, phone text, company text, country text, source text, status text)
    where coalesce(length(btrim(name)), 0) not between 1 and 200
       or length(email) > 254 or length(phone) > 40 or length(company) > 200
       or length(country) > 100 or length(source) > 100 or length(status) > 100
       or (nullif(btrim(email), '') is not null and btrim(email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
       or (nullif(btrim(phone), '') is not null and length(regexp_replace(phone, '[^0-9]', '', 'g')) not between 5 and 20)
  ) then
    raise exception 'At least one lead has an invalid name, email, phone or field length' using errcode = '22023';
  end if;

  insert into public.leads (name, email, phone, company, country, source, status)
  select btrim(name), nullif(btrim(email), ''), nullif(btrim(phone), ''),
         nullif(btrim(company), ''), nullif(btrim(country), ''),
         coalesce(nullif(btrim(source), ''), 'Manual'),
         coalesce(nullif(btrim(status), ''), 'New')
  from jsonb_to_recordset(entries) as entry(name text, email text, phone text, company text, country text, source text, status text)
  on conflict do nothing;
  get diagnostics inserted_count = row_count;
  return jsonb_build_object('inserted', inserted_count, 'duplicates', entry_count - inserted_count);
end;
$$;

revoke all on function public.campaign_import_leads(jsonb) from public, anon, authenticated;
grant execute on function public.campaign_import_leads(jsonb) to authenticated;
