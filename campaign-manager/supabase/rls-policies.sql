-- AAROHAN AI Campaign Manager: tenant-isolated RLS policies.
-- Apply AFTER schema.sql in a staging Supabase project. Review with real test users.
-- Membership creation must happen through a trusted server/admin invite flow; no self-join policy.

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = target_org
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.has_org_role(target_org uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = target_org
      and m.user_id = (select auth.uid())
      and m.role = any(allowed_roles)
  );
$$;

revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.has_org_role(uuid, text[]) from public;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, text[]) to authenticated;

-- Make this policy script safe to re-run in staging.
drop policy if exists organizations_member_select on public.organizations;
drop policy if exists members_same_org_select on public.organization_members;
drop policy if exists campaigns_member_select on public.campaigns;
drop policy if exists campaigns_manager_insert on public.campaigns;
drop policy if exists campaigns_manager_update on public.campaigns;
drop policy if exists campaigns_admin_delete on public.campaigns;
drop policy if exists contacts_member_select on public.contacts;
drop policy if exists contacts_operator_insert on public.contacts;
drop policy if exists contacts_operator_update on public.contacts;
drop policy if exists contacts_admin_delete on public.contacts;
drop policy if exists permissions_member_select on public.contact_channel_permissions;
drop policy if exists permissions_operator_write on public.contact_channel_permissions;
drop policy if exists permissions_operator_insert on public.contact_channel_permissions;
drop policy if exists permissions_operator_update on public.contact_channel_permissions;
drop policy if exists permissions_member_withdraw_insert on public.contact_channel_permissions;
drop policy if exists permissions_member_withdraw_update on public.contact_channel_permissions;
drop policy if exists campaign_contacts_member_select on public.campaign_contacts;
drop policy if exists campaign_contacts_operator_write on public.campaign_contacts;
drop policy if exists suppression_member_select on public.suppression_list;
drop policy if exists suppression_operator_write on public.suppression_list;
drop policy if exists suppression_operator_insert on public.suppression_list;
drop policy if exists suppression_member_optout_insert on public.suppression_list;
drop policy if exists attempts_member_select on public.outreach_attempts;
drop policy if exists audit_admin_select on public.audit_events;
drop policy if exists audit_actor_insert on public.audit_events;

-- Organization and membership visibility
create policy organizations_member_select
on public.organizations for select to authenticated
using (public.is_org_member(id));

create policy members_same_org_select
on public.organization_members for select to authenticated
using (public.is_org_member(organization_id));

-- Only trusted server-side provisioning (service role) can insert/update memberships.
-- No authenticated INSERT/UPDATE/DELETE policy is intentionally provided.

create policy campaigns_member_select
on public.campaigns for select to authenticated
using (public.is_org_member(organization_id));
create policy campaigns_manager_insert
on public.campaigns for insert to authenticated
with check (
  public.has_org_role(organization_id, array['owner','admin','operator'])
  and status = 'draft'
  and dry_run is true
);
-- Campaign status and dry_run are intentionally not client-updatable. Future approval/pause
-- must use dedicated audited server-side endpoints with explicit owner authorization.
create policy campaigns_admin_delete
on public.campaigns for delete to authenticated
using (public.has_org_role(organization_id, array['owner','admin']));

create policy contacts_member_select
on public.contacts for select to authenticated
using (public.is_org_member(organization_id));
create policy contacts_operator_insert
on public.contacts for insert to authenticated
with check (public.has_org_role(organization_id, array['owner','admin','operator']));
create policy contacts_operator_update
on public.contacts for update to authenticated
using (public.has_org_role(organization_id, array['owner','admin','operator']))
with check (public.has_org_role(organization_id, array['owner','admin','operator']));
create policy contacts_admin_delete
on public.contacts for delete to authenticated
using (public.has_org_role(organization_id, array['owner','admin']));

create policy permissions_member_select
on public.contact_channel_permissions for select to authenticated
using (public.is_org_member(organization_id));
-- Do not grant ALL here: operator DELETE previously allowed a direct client to
-- remove a withdrawn permission row and then reinsert it as "granted".
-- Keep explicit INSERT/UPDATE for approved operators and the separate opt-out
-- policies below; RLS deliberately has no authenticated DELETE policy.
create policy permissions_operator_insert
on public.contact_channel_permissions for insert to authenticated
with check (public.has_org_role(organization_id, array['owner','admin','operator']));
create policy permissions_operator_update
on public.contact_channel_permissions for update to authenticated
using (public.has_org_role(organization_id, array['owner','admin','operator']))
with check (public.has_org_role(organization_id, array['owner','admin','operator']));

-- DB-enforced guard: no direct user update can undo a withdrawn preference,
-- alter a permission's tenant/contact/channel identity, or manufacture a grant
-- without any supporting evidence. A future re-consent flow must be separate,
-- verified, audited, and explicitly designed before allowing reinstatement.
create or replace function public.guard_contact_channel_permission()
returns trigger language plpgsql security invoker set search_path = '' as $guard$
begin
  if TG_OP = 'UPDATE' then
    if (old.organization_id, old.contact_id, old.channel)
       is distinct from (new.organization_id, new.contact_id, new.channel) then
      raise exception 'Permission identity cannot change' using errcode = '23514';
    end if;
    if old.permission_status = 'withdrawn' and new.permission_status <> 'withdrawn' then
      raise exception 'Withdrawn permission cannot be reinstated by update'
        using errcode = '23514';
    end if;
  end if;
  if new.permission_status = 'granted' and (
       nullif(btrim(new.evidence_reference), '') is null
       or new.captured_by is null
       or new.captured_at is null
     ) then
    raise exception 'A granted permission requires evidence, actor and timestamp'
      using errcode = '23514';
  end if;
  return new;
end
$guard$;
drop trigger if exists guard_contact_channel_permission on public.contact_channel_permissions;
create trigger guard_contact_channel_permission
before insert or update on public.contact_channel_permissions
for each row execute function public.guard_contact_channel_permission();
revoke all on function public.guard_contact_channel_permission() from public, anon;
create policy permissions_member_withdraw_insert
on public.contact_channel_permissions for insert to authenticated
with check (public.is_org_member(organization_id) and permission_status = 'withdrawn');
create policy permissions_member_withdraw_update
on public.contact_channel_permissions for update to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id) and permission_status = 'withdrawn');

create policy campaign_contacts_member_select
on public.campaign_contacts for select to authenticated
using (public.is_org_member(organization_id));
create policy campaign_contacts_operator_write
on public.campaign_contacts for all to authenticated
using (public.has_org_role(organization_id, array['owner','admin','operator']))
with check (public.has_org_role(organization_id, array['owner','admin','operator']));

create policy suppression_member_select
on public.suppression_list for select to authenticated
using (public.is_org_member(organization_id));
create policy suppression_operator_insert
on public.suppression_list for insert to authenticated
with check (public.has_org_role(organization_id, array['owner','admin','operator']));
create policy suppression_member_optout_insert
on public.suppression_list for insert to authenticated
with check (
  public.is_org_member(organization_id)
  and source = 'campaign_manager_opt_out'
  and channel is not null
);

create policy attempts_member_select
on public.outreach_attempts for select to authenticated
using (public.is_org_member(organization_id));
-- Attempt creation/status updates are reserved for trusted server-side workers.

create policy audit_admin_select
on public.audit_events for select to authenticated
using (public.has_org_role(organization_id, array['owner','admin']));
create policy audit_actor_insert
on public.audit_events for insert to authenticated
with check (
  actor_user_id = (select auth.uid())
  and public.is_org_member(organization_id)
  and event_type = 'contact_permission_withdrawn'
);
-- Clients may append only narrowly scoped, self-attributed opt-out audit events; no update/delete.

-- Helpful integrity indexes. The partial unique index prevents duplicate provider callbacks.
create unique index if not exists idx_attempts_provider_reference_unique
on public.outreach_attempts(provider, provider_reference)
where provider is not null and provider_reference is not null;

-- Composite organization foreign keys in schema.sql additionally enforce same-tenant
-- references. Never add a broad client update policy for campaign status or dry_run.
