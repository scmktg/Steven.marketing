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

An administrator must enter **both the agreed contract commencement date and the fixed monthly baseline** before the system calculates revenue-growth commissions. These values have not been inferred from marketing campaign dates or historical sales figures.

A contract starting **17 September 2026** uses the following *illustrative* periods (not confirmation of the actual Enviro Aqua commencement):

- 17 Sep–16 Oct
- 17 Oct–16 Nov
- 17 Nov–16 Dec

For a contract starting on the 31st, monthly anniversaries are clamped to the last day in shorter months, then recalculated against the **original 31st**, preventing drift: 31 Jan–27 Feb; 28 Feb–30 Mar; 31 Mar–29 Apr (non-leap-year example). The last day of a billing period is the day before the following anniversary. No pro-rata baseline adjustment is applied; the fixed baseline applies to each full anniversary cycle.

The implementation in `src/lib/commission.ts` uses `Australia/Sydney` dates and includes an explicit current-as-of date. Commission calculations use complete daily Shopify *net sales* records for every day included in the current partial or completed period. If any day is missing, it returns **no commission estimate**, not an extrapolated amount.

**Important:** The signed agreement controls the eligible revenue definition (e.g. GST, shipping, refunds, cancellations and manual sales). ShopifyQL `net_sales` is currently a provisional reporting metric. Any finalized commission must be reconciled and approved before invoicing.

## Data status (14 Oct 2026)

- The daily sales backfill covers 1 July–14 October 2026 (106 days), including no-sale days. All four calendar-month totals were crosschecked with the previous Shopify snapshot.
- The daily dataset is currently **a one-time snapshot**, not a recurring Shopify integration. Dates after the last synced day will be marked incomplete; commissions will **not** silently use stale or calendar-month totals.
- Calendar-month sales and Google Ads reporting are still calendar-month reports and are labelled separately. Google Ads campaign spend **does not** change the commission calculation unless the signed agreement explicitly provides for it.
- All daily sales rows are readable only through agency-admin and tenant-member RLS. Authenticated browsers cannot insert, update or delete daily reports. Provider credentials are not stored in this system.

## Operational controls

1. Administrator opens `/agency/commissions` and selects the client.
2. Enter commencement date and fixed monthly baseline from the signed agreement, confirm tier caps and rates, then save.
3. Review the current anniversary period and its daily-data coverage. Historical periods appear below the form, limited to the latest six.
4. Do not change historical terms without reviewing affected invoices. **Versioned terms, approved period closing, and recurring ingestion remain future enhancements**; this feature provides provisional estimates only.
5. Before external client rollout, configure Shopify daily sync, source reconciliation, MFA and credential management as described in `docs/REPORTING_SECURITY.md`.

The period calculation itself is fully implemented. The actual Enviro Aqua commencement date and baseline remain intentionally blank until confirmed.
