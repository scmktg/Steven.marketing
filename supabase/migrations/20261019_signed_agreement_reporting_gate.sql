-- SECURITY GATE: apply only together with the full verified-signature
-- activation migration. This is a draft, NOT applied to production.
-- Restrictive policies add an AND condition to existing permissive RLS.
-- Agency administrators retain existing privileges.
-- Existing client memberships alone DO NOT authorise reporting reads.
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'client_monthly_metrics','client_daily_sales','client_daily_ad_spend',
    'client_terms','client_invoices','client_ad_budget_settings',
    'client_ad_budget_requests'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tbl);
    EXECUTE format($policy$
      CREATE POLICY "Require fully signed agreement for reporting" ON public.%I
      AS RESTRICTIVE FOR SELECT TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.agency_admins a
                WHERE a.user_id=(select auth.uid()))
        OR EXISTS (
          SELECT 1 FROM public.client_agreements ca
          WHERE ca.client_id = %I.client_id
            AND ca.status = 'signed'
            AND ca.signed_at IS NOT NULL
            AND ca.signing_evidence_key IS NOT NULL
        )
      )
    $policy$,tbl,tbl);
  END LOOP;
END $$;

-- This policy is not a substitute for secure, transactional finalisation
-- and storage of audit evidence. Require signed agreement verification
-- before any migration of existing clients to this access model.
