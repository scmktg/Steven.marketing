-- Applied in Supabase txzaubnzumdcnshocjzz on 14 October 2026.
-- Adds contract-anniversary based tiered commission support.
ALTER TABLE public.client_terms
  ADD COLUMN IF NOT EXISTS contract_start_date date,
  ADD COLUMN IF NOT EXISTS tier_1_limit_aud numeric(14,2) DEFAULT 20000,
  ADD COLUMN IF NOT EXISTS tier_2_limit_aud numeric(14,2) DEFAULT 50000,
  ADD COLUMN IF NOT EXISTS tier_1_rate numeric(8,6) DEFAULT 0.12,
  ADD COLUMN IF NOT EXISTS tier_2_rate numeric(8,6) DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS tier_3_rate numeric(8,6) DEFAULT 0.08;
ALTER TABLE public.client_terms
  DROP CONSTRAINT IF EXISTS client_terms_commission_model_check,
  DROP CONSTRAINT IF EXISTS revenue_growth_terms_complete;
ALTER TABLE public.client_terms
  ADD CONSTRAINT client_terms_commission_model_check CHECK(commission_model IN('revenue_growth','tiered_revenue_growth','manual')),
  ADD CONSTRAINT revenue_growth_terms_complete CHECK(commission_model<>'revenue_growth' OR (contract_start_date IS NOT NULL AND baseline_monthly_aud IS NOT NULL AND commission_rate IS NOT NULL)),
  ADD CONSTRAINT tiered_growth_terms_complete CHECK(commission_model<>'tiered_revenue_growth' OR (contract_start_date IS NOT NULL AND baseline_monthly_aud IS NOT NULL AND tier_1_limit_aud IS NOT NULL AND tier_2_limit_aud IS NOT NULL AND tier_1_rate IS NOT NULL AND tier_2_rate IS NOT NULL AND tier_3_rate IS NOT NULL)),
  ADD CONSTRAINT tier_limits_valid CHECK(tier_1_limit_aud IS NULL OR tier_2_limit_aud IS NULL OR (tier_1_limit_aud>0 AND tier_2_limit_aud>tier_1_limit_aud)),
  ADD CONSTRAINT tier_rates_valid CHECK((tier_1_rate IS NULL OR tier_1_rate BETWEEN 0 AND 1) AND (tier_2_rate IS NULL OR tier_2_rate BETWEEN 0 AND 1) AND (tier_3_rate IS NULL OR tier_3_rate BETWEEN 0 AND 1));
CREATE TABLE IF NOT EXISTS public.client_daily_sales(
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  day date NOT NULL,
  gross_sales_aud numeric(14,2),
  net_sales_aud numeric(14,2),
  orders integer CHECK (orders >= 0),
  shopify_synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(client_id,day)
);
CREATE INDEX IF NOT EXISTS client_daily_sales_period_idx ON public.client_daily_sales(client_id,day DESC);
ALTER TABLE public.client_daily_sales ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_daily_sales FROM anon,authenticated;
GRANT SELECT ON public.client_daily_sales TO authenticated;
CREATE POLICY "Members see their own daily sales" ON public.client_daily_sales FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.client_memberships m WHERE m.client_id=client_daily_sales.client_id AND m.user_id=(SELECT auth.uid())));
CREATE POLICY "Agency read daily sales" ON public.client_daily_sales FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.agency_admins a WHERE a.user_id=(SELECT auth.uid())));
