# Steven Marketing — secure reporting integrations

Status: **Initial Enviro Aqua reporting snapshot imported; unattended integrations NOT enabled.** Last reviewed: 14 October 2026.

## Data architecture (production target)

1. Supabase Auth signs users in; `public.agency_admins` determines agency-level privileges.
2. The browser reads only the authenticated user's permitted tenant records through the Supabase **publishable** key and RLS. It never receives provider tokens, refresh tokens, secret database keys, raw customer orders, or the Google Ads/Windsor API key.
3. A **separate private scheduled worker** pulls aggregate reports from explicitly linked Shopify and Google Ads accounts. It is not callable anonymously. Its configuration and access are independent of user-supplied client IDs.
4. Server-side schema validation confirms: exact source account binding, AUD currency, Australia/Sydney reporting timezone, date range, numeric precision, plausible totals and absence of unexpected PII.
5. The worker writes **only** whitelisted month-level fields to a *narrowly scoped* database ingestion role or fixed-tenant write procedure (preferred). Do not give a generic ETL tool a Supabase service-role secret. Never use the browser publishable key as an ingestion credential.
6. Client-side reads stay governed by RLS: users see only clients they belong to; agency administrators can review all clients. Database administrators are a separate trust boundary.
7. Each scheduled import records a server-side run ID, source, reporting window, timestamp, row count, checksum and success/failure reason. On any partial failure, do not publish a partial updated month or suppress the previous good report.

## Existing data

- Enviro Aqua Shopify shop and Google Ads account were read through **existing authenticated ChatGPT connectors**.
- Monthly *aggregated* Shopify gross/net sales and order counts and Google Ads spend were inserted into the tenant's `client_monthly_metrics` rows for July–October 2026. **This was a one-time snapshot**, not a persistent connection.
- The Google Ads account is in **AUD** and uses **Australia/Sydney** timezone.
- No Shopify customer names, addresses, emails, individual order data or payment details were copied into the portal.
- October data is month-to-date through October 14. Refunds, attribution windows and historical corrections can change previously reported periods. Contract-specific commission baseline and calculation have **not** been approved.
- Do not mark commission estimates as invoices or liabilities until the signed contract defines GST, refunds, exclusions and adjustments.

## Shopify

- Investigate `shopifyqlQuery` for aggregate-only exports; it uses `read_reports`, but current Shopify Admin GraphQL documentation also requires Level 2 protected customer-data access, even for this reporting API. Confirm eligibility before developing a production app.
- Request the narrowest scopes and avoid `write_*` and `read_orders` if the reporting API covers the needed metrics.
- Match the *exact Shopify shop identity* to the configured tenant, server-side. Never accept a `shop` or `client_id` parameter from a public request to decide where to store results.
- If webhooks are ever introduced, verify Shopify's HMAC against the original raw request body, enforce replay protections, and store no raw order PII.

## Google Ads / Windsor.ai

- Only read data for the explicitly bound advertising account. Reject a response containing other account IDs or currencies; never silently combine different accounts.
- Windsor's Connectors API currently requires `api_key` in URL query parameters (not a header). Keep that URL **server-side**, never log it, never send it through analytics or browser requests, redact it in errors/trace output, and rotate the key. Consider direct Google Ads API OAuth if a safer/stronger supported authentication mechanism is needed.
- Costs are actual Google Ads account spend, **not** Shopify-attributed revenue or a reliable ROAS denominator without attribution verification.

## Secrets, tenancy and operations — required before enabling automation

- Do not put Shopify, Windsor, Supabase secret/service-role, cron or database credentials in `NEXT_PUBLIC_*`, GitHub commits, query strings to the portal, or this documentation.
- Use isolated encrypted production environment variables, least-privilege credentials and a documented rotation/revocation procedure. Vercel team permissions currently prevent updating production environment variables through the connected automation tool; set them directly in the Vercel project UI if required.
- Keep provider credentials separate per client. Revoking one client's authorisation must stop its sync without affecting others.
- Enforce MFA for administrators before customer-facing rollout. Enable Supabase leaked-password protection; review Auth session duration and invite-only sign-up configuration.
- Restrict the ingestion worker to a scheduler identity and an explicit account-to-tenant mapping; use non-guessable credentials, replay protection, alerting and a manual kill switch. Do not create a public `/api/sync?token=...` endpoint.
- Implement retry/backoff and rate limits, pagination, idempotent month upserts, atomic updates, and recurring re-synchronisation of at least the current and prior month.
- Log *metadata only* (counts, dates, statuses and trace IDs), not secrets, request bodies with PII or unrestricted API URLs.
- Before allowing clients to log in, run positive and negative RLS tests for **anon**, unrelated authenticated user, member of client A, member of client B, and agency admin; test `SELECT` and forbidden `INSERT/UPDATE/DELETE` paths. Verify a client cannot grant themself a membership or agency role.
- Audit admin access, credentials and permissions regularly; keep backups and a rollback procedure. Treat a security warning as a rollout blocker until remediated.

## Acceptance criteria for enabling automated updates

- Approved, narrowly scoped source credentials obtained securely and stored only in server-side secret storage.
- Independent background worker working on a test tenant in preview; no browser-callable ingestion routes.
- Automated tests demonstrate tenant isolation and reject wrong-account, wrong-currency, malformed, duplicated and partial data.
- Reconciled sample periods against both Shopify and Google Ads native reporting, with documented time boundaries and definitions.
- Operational alerting, secret rotation, MFA and recovery procedures verified.
- Explicit administrator approval before enabling the production schedule.

**Security note:** No system can promise 100% security. These controls minimise unnecessary access, reduce impact of compromised components and create testable security boundaries.
