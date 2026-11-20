CREATE OR REPLACE FUNCTION public.campaign_enroll_for_follow_up(p_campaign uuid, p_lead uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR (auth.jwt()->'app_metadata'->>'campaign_manager_role') IS DISTINCT FROM 'admin' THEN RAISE insufficient_privilege; END IF;
 PERFORM 1 FROM public.campaigns WHERE id=p_campaign AND channel='Manual' AND status='Active' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Select an active manual campaign'; END IF;
 INSERT INTO public.campaign_leads(campaign_id,lead_id,status) VALUES(p_campaign,p_lead,'Pending') ON CONFLICT(campaign_id,lead_id) DO NOTHING;
 IF FOUND THEN
 UPDATE public.leads SET follow_up_on=COALESCE(follow_up_on,(now() AT TIME ZONE 'Asia/Kolkata')::date+1) WHERE id=p_lead;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.campaign_enroll_for_follow_up(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.campaign_enroll_for_follow_up(uuid,uuid) TO authenticated;