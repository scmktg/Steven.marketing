-- Supabase project reporting changes, 14 October 2026. No account IDs or financial values stored in source.
-- Ad spend is imported from an administrator-authorized Google Ads data connection.
-- Dates are Google Ads account-local calendar dates (Australia/Sydney in the connected store).
-- Source readings retain four decimals; presentation rounds the summed reporting interval to cents.
CREATE TABLE IF NOT EXISTS public.client_daily_ad_spend (
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  day date NOT NULL,
  ads_account_id text NOT NULL CHECK(length(ads_account_id) BETWEEN 1 AND 80),
  ad_spend_aud numeric(14,4) NOT NULL CHECK(ad_spend_aud>=0),
  ads_synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(client_id,day,ads_account_id)
);
CREATE INDEX IF NOT EXISTS client_daily_ad_spend_day_idx
  ON public.client_daily_ad_spend (client_id,day DESC);
ALTER TABLE public.client_daily_ad_spend ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_daily_ad_spend FROM anon,authenticated;
GRANT SELECT ON public.client_daily_ad_spend TO authenticated;
DROP POLICY IF EXISTS "Agency read daily Google Ads spend" ON public.client_daily_ad_spend;
CREATE POLICY "Agency read daily Google Ads spend" ON public.client_daily_ad_spend
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.agency_admins a
    WHERE a.user_id=(SELECT auth.uid())));
DROP POLICY IF EXISTS "Members see their own Google Ads spend" ON public.client_daily_ad_spend;
CREATE POLICY "Members see their own Google Ads spend" ON public.client_daily_ad_spend
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.client_memberships m
    WHERE m.client_id=client_daily_ad_spend.client_id AND m.user_id=(SELECT auth.uid())));
COMMENT ON TABLE public.client_daily_ad_spend IS
  'Daily account-level Google Ads spend in AUD. Read-only for authenticated tenant members and agency administrators. Populated from private authorized reporting integrations.';

-- Add the new configurable overview card keys. No privilege changes beyond existing
-- agency-admin-only self-owned preferences.
ALTER TABLE public.agency_dashboard_preferences
  DROP CONSTRAINT IF EXISTS agency_dashboard_preferences_visible_cards_check;
ALTER TABLE public.agency_dashboard_preferences
  ADD CONSTRAINT agency_dashboard_preferences_visible_cards_check CHECK (
    cardinality(visible_cards) BETWEEN 1 AND 8
    AND visible_cards <@ ARRAY[
      'revenue_after_costs','contract_ad_spend',
      'revenue','total_sales','net_sales','gross_sales','shipping',
      'growth','commission','orders','ad_spend'
    ]::text[]
  );
ALTER TABLE public.agency_dashboard_preferences
  ALTER COLUMN visible_cards
  SET DEFAULT ARRAY[
    'revenue_after_costs','revenue','total_sales','shipping',
    'growth','commission','contract_ad_spend','ad_spend'
  ]::text[];
