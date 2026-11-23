-- AAROHAN Campaign Manager: atomic authenticated opt-out RPC (STAGING ONLY).
-- A single PostgREST RPC call runs as the authenticated INVOKER under existing
-- tenant RLS. If suppression, withdrawal or audit INSERT fails, PostgreSQL
-- rolls back ALL three changes automatically; never partially opt out.
-- Requires schema.sql, rls-policies.sql and the contact/channel unique index.
CREATE OR REPLACE FUNCTION public.record_campaign_contact_opt_out(
  p_contact_id uuid,
  p_channel text,
  p_reason text DEFAULT 'contact_request'
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $opt_out$
DECLARE
  v_actor uuid := auth.uid();
  v_contact public.contacts%ROWTYPE;
  v_reason text := COALESCE(NULLIF(btrim(p_reason), ''), 'contact_request');
BEGIN
  IF v_actor IS NULL OR p_contact_id IS NULL OR p_channel IS NULL
     OR p_channel NOT IN ('voice','whatsapp','email')
     OR length(v_reason) > 300 THEN
    RAISE EXCEPTION 'Invalid opt-out request' USING ERRCODE = '22023';
  END IF;

  -- INVOKER RLS scopes SELECT to a real organization member. Never accept
  -- organization_id from a client or derive it from untrusted JWT metadata.
  SELECT * INTO v_contact FROM public.contacts
  WHERE id = p_contact_id;
  IF NOT FOUND OR NOT public.is_org_member(v_contact.organization_id) THEN
    RAISE EXCEPTION 'Contact not found or access denied'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.suppression_list (
    organization_id, contact_id, phone_e164, channel, reason, source
  ) VALUES (
    v_contact.organization_id, v_contact.id, v_contact.phone_e164,
    p_channel, v_reason, 'campaign_manager_opt_out'
  ) ON CONFLICT (contact_id, channel) DO NOTHING;

  -- Preserve any original recorded grant metadata when changing the status.
  -- A first-time withdrawal captures the actor and time. An existing
  -- permission retains its original evidence and timestamps for review.
  INSERT INTO public.contact_channel_permissions (
    organization_id, contact_id, channel, permission_status,
    evidence_reference, captured_at, captured_by
  ) VALUES (
    v_contact.organization_id, v_contact.id, p_channel,
    'withdrawn', NULL, now(), v_actor
  ) ON CONFLICT (contact_id, channel) DO UPDATE
      SET permission_status = 'withdrawn';

  INSERT INTO public.audit_events (
    organization_id, actor_user_id, event_type,
    entity_type, entity_id, details
  ) VALUES (
    v_contact.organization_id, v_actor, 'contact_permission_withdrawn',
    'contact', v_contact.id,
    jsonb_build_object('channel', p_channel, 'source', 'campaign_manager_opt_out')
  );

  RETURN jsonb_build_object(
    'success', true,
    'suppressed', true,
    'permission_status', 'withdrawn',
    'audit_recorded', true
  );
END;
$opt_out$;

REVOKE ALL ON FUNCTION public.record_campaign_contact_opt_out(uuid, text, text)
FROM public, anon;
GRANT EXECUTE ON FUNCTION public.record_campaign_contact_opt_out(uuid, text, text)
TO authenticated;

-- There is intentionally NO service_role bypass, queueing or provider sending.
-- Production AAROHAN CRM has an incompatible existing schema: DO NOT deploy.
