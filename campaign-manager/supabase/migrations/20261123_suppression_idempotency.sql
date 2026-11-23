-- Existing-install migration for a DEDICATED multi-tenant staging database ONLY.
-- DO NOT run against the AAROHAN production CRM, which has an incompatible
-- legacy schema. Back up staging first and pause opt-out/import writes.
--
-- This migration NEVER deduplicates, deletes or changes any suppression row.
-- Fail closed if existing duplicate (contact_id, channel) records would make
-- PostgREST's ON CONFLICT DO NOTHING unsafe or ambiguous.
BEGIN;
DO $preflight$
DECLARE duplicate_groups integer;
BEGIN
  IF to_regclass('public.suppression_list') IS NULL THEN
    RAISE EXCEPTION 'No tenant suppression_list table. Use fresh schema instead.';
  END IF;
  SELECT count(*) INTO duplicate_groups
  FROM (
    SELECT contact_id, channel
    FROM public.suppression_list
    WHERE contact_id IS NOT NULL AND channel IS NOT NULL
    GROUP BY contact_id, channel
    HAVING count(*) > 1
  ) duplicates;
  IF duplicate_groups > 0 THEN
    RAISE EXCEPTION
      'STOP: % duplicate contact/channel suppression groups. Review manually before retrying.',
      duplicate_groups;
  END IF;
END
$preflight$;
CREATE UNIQUE INDEX IF NOT EXISTS idx_suppression_contact_channel_unique
  ON public.suppression_list (contact_id, channel);
COMMIT;

-- Safe rollout: activate the matching .upsert(..., {onConflict:
-- "contact_id,channel", ignoreDuplicates:true}) API change only AFTER the
-- unique index exists in that same dedicated staging database.
