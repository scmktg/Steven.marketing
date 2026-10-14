# Contract-anniversary commission engine

## Enviro Aqua: marginal tier schedule

Only **additional** eligible monthly revenue above the agreed fixed baseline attracts commission:

| Incremental revenue above baseline | Rate |
| --- | ---: |
| $0 to $20,000 | 12% |
| $20,000 to $50,000 | 10% on the portion in this band |
| Above $50,000 | 8% on the portion beyond $50,000 |

At $60,000 above baseline, commission is (20,000 × 12%) + (30,000 × 10%) + (10,000 × 8%) = **$6,200**. Each band is calculated marginally and rounded to cents. There is no retroactive rate reduction on earlier bands.

In **Agency → Commissions**, Enviro Aqua is preselected for the tiered model, with editable $20k/$50k cutoffs and 12/10/8% rates; these settings are not contractual until saved by an administrator. Other clients can use a flat growth rate or a manually reconciled agreement.

## Contract commencement and period boundaries

An administrator must enter **both the agreed contract commencement date and the fixed monthly baseline** before the system calculates revenue-growth commissions. These values must come from a saved administrator-approved agreement, not be inferred from marketing campaign dates or historical sales figures.

An anniversary period beginning **17 September 2026** uses the following dates (Enviro Aqua currently has a 17 March 2026 contract start saved, which yields the same September anniversary):

- 17 Sep–16 Oct
- 17 Oct–16 Nov
- 17 Nov–16 Dec

For a contract starting on the 31st, monthly anniversaries are clamped to the last day in shorter months, then recalculated against the **original 31st**, preventing drift: 31 Jan–27 Feb; 28 Feb–30 Mar; 31 Mar–29 Apr (non-leap-year example). The last day of a billing period is the day before the following anniversary. No pro-rata baseline adjustment is applied; the fixed baseline applies to each full anniversary cycle.

The implementation in `src/lib/commission.ts` uses `Australia/Sydney` dates and includes an explicit current-as-of date. Commission calculations use complete daily Shopify records for every day included in the current partial or completed period. The administrator chooses a per-client revenue basis: **net product sales excluding shipping** or **Shopify total sales including shipping**. If any required day or the selected measure is missing, the engine returns **no commission estimate**, not an extrapolated amount.

**Important:** The signed agreement controls the eligible revenue definition (e.g. GST, shipping, refunds, cancellations and manual sales). ShopifyQL `net_sales` and `total_sales` are reporting metrics, not by themselves legal definitions of commissionable revenue. Enviro Aqua is currently configured to use Shopify `total_sales`, as that matches the requested 17 September–16 October revenue figure. Any finalized commission must be reconciled and approved before invoicing.

## Data status (14 Oct 2026)

- The daily sales backfill covers 1 July–14 October 2026 (106 days), including no-sale days. All four calendar-month net/gross totals were crosschecked against Shopify; daily shipping and total-sales values were also imported and reconciled.
- On 14 October the current 17 September–16 October period had 28 days of data, with $19,824.99 net product sales, $906.70 shipping and $20,731.69 Shopify total sales. With a saved $3,495.50 baseline and the marginal 12% tier, that implies a **provisional $2,068.34** commission, pending contract reconciliation.
- The daily dataset is currently **a one-time snapshot**, not a recurring Shopify integration. Dates after the last synced day will be marked incomplete; commissions will **not** silently use stale or calendar-month totals.
- Calendar-month sales and Google Ads reporting are still calendar-month reports and are labelled separately. Google Ads campaign spend **does not** change the commission calculation unless the signed agreement explicitly provides for it.
- All daily sales rows are readable only through agency-admin and tenant-member RLS. Authenticated browsers cannot insert, update or delete daily reports. Provider credentials are not stored in this system.

## Operational controls

1. Administrator opens `/agency/commissions` and selects the client.
2. Enter commencement date and fixed monthly baseline from the signed agreement, confirm eligible revenue basis and tier caps/rates, then save.
3. Review the current anniversary period and its daily-data coverage. Historical periods appear below the form, limited to the latest six.
4. Do not change historical terms without reviewing affected invoices. **Versioned terms, approved period closing, and recurring ingestion remain future enhancements**; this feature provides provisional estimates only.
5. Before external client rollout, configure Shopify daily sync, source reconciliation, MFA and credential management as described in `docs/REPORTING_SECURITY.md`.

The period calculation and configurable reporting-basis display are implemented. Client-specific contract settings are saved in Supabase, not the repository; the dashboard distinguishes the current anniversary reporting period from Shopify and Google Ads calendar-month reporting.

## Customisable agency overview

Agency administrators can choose **Contract anniversary periods** or **Calendar month** as their default revenue display and select up to eight KPI cards. The preference is stored under the administrator’s own user ID, with RLS restricting access to that administrator. In the All clients view, the portfolio sums each client’s own current contract period; the table shows exact dates for each client. Missing daily data suppresses the full portfolio financial totals rather than silently reporting a partial sum. Growth and commission remain based on contract periods even when calendar-month reporting is selected, while advertising spend is explicitly labelled as calendar-month data.

