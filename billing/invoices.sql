CREATE TABLE public.billing_invoices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 quotation_id uuid NOT NULL UNIQUE REFERENCES public.billing_quotations(id),
 issued_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_invoices FROM public,anon,authenticated;
GRANT SELECT ON public.billing_invoices TO authenticated;
CREATE POLICY billing_invoices_admin_read ON public.billing_invoices FOR SELECT TO authenticated USING ((auth.jwt()->'app_metadata'->>'campaign_manager_role')='admin');
CREATE FUNCTION public.billing_issue_invoice(p_quotation_id uuid) RETURNS public.billing_invoices
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result public.billing_invoices;
BEGIN
 IF (auth.jwt()->'app_metadata'->>'campaign_manager_role') IS DISTINCT FROM 'admin' THEN RAISE insufficient_privilege; END IF;
 INSERT INTO public.billing_invoices(quotation_id) VALUES(p_quotation_id) ON CONFLICT(quotation_id) DO NOTHING;
 SELECT * INTO STRICT result FROM public.billing_invoices WHERE quotation_id=p_quotation_id;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.billing_issue_invoice(uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.billing_issue_invoice(uuid) TO authenticated;