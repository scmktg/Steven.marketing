# Advertising budgets and client approvals

## Purpose

Clients authorise a **calendar-month** advertising spending limit. Steven can allocate the authorised amount between campaigns and recommend changes, but proposed changes do not change the approved limit until an authorised client owner approves them. Separate from contract anniversary months, growth commissions and live Google Ads settings.

## Workflow

1. Create a business under **Agency → Clients**. On success, the new business opens in **Agency → Advertising**.
2. Enter **initial monthly testing budget**, **stage** (Testing, Optimising or Scaling) and **advertising objectives**. This is a plan, **not client authorisation**.
3. Steven recommends an initial approved monthly ceiling or a revised ceiling and includes a specific reason. A proposal cannot be the same as the current limit and cannot overwrite another pending proposal.
4. In **Client → Advertising**, the client's **owner** sees the proposed and prior limits, explanation, and Approve / Decline actions. Viewers can inspect but not decide. Their decision is recorded with account identity and timestamp.
5. The approved monthly cap becomes effective in the portal when approved. The request history remains available to the client and agency. Steven can withdraw a still-pending request.
6. An approval **does not modify Google Ads** or charge a client. Campaign budgets and monitoring remain a separate manual responsibility pending a safe, explicit API integration.

## Accurate reporting

- Google Ads spending snapshots are from `public.client_daily_ad_spend`, in AUD and account-local dates. An estimated remaining spend figure appears only if the dates since the beginning of the calendar month are all covered. Missing dates show an unavailable balance rather than a false allowance.
- The existing `client_monthly_metrics` reports are retained and clearly labelled as calendar-month *snapshots*, not live cap enforcement.
- Spending limit is an authorisation, not a guarantee of platform-imposed hard caps. Google Ads can vary daily spending; Steven must monitor and adjust campaigns responsibly.
- The contract is still the compact personal Steven Marketing agreement. The revised Schedule A displays an initial testing plan, approved limit and objectives, and Schedule B explains written authorisation through the dashboard. Updating these fields never amends a previously signed agreement without appropriate consent.

## Security controls

- `client_ad_budget_settings` / `client_ad_budget_requests` use RLS.
- Only the agency administrator can create and edit a non-authorising plan and propose or withdraw changes.
- No browser client (including an admin) receives permission to write the approved limit directly or insert/update approval records.
- `propose_ad_budget` and `withdraw_ad_budget_proposal` validate an agency administrator using `auth.uid()`.
- `decide_ad_budget_request` requires an authenticated **client owner** for that exact client's record; agency admins and client viewers cannot approve.
- Approvals use a transaction with row locks, previous-budget matching, status checks, and a unique outstanding-request index. Requests cannot be approved twice or applied to a changed limit.
- Admins and a client's own authenticated members can read only the applicable budget data.
- Approval tests were performed inside a rolled-back SQL transaction with a temporary synthetic client identity and did not change production client budgets.

## Current scope / known limitations

- This system records approvals and displays the budget, but **does not automatically email budget proposals**, because client contact emails and invitations are not yet part of the live onboarding flow.
- SignWell e-signing/client onboarding and automatic Google Ads campaign budget updates remain separate, not-yet-enabled integrations.
- Existing clients have no new advertising limit by default. Do not assume authority from historical spending.
- A client may request a reduction or pause through the displayed email contact. An on-platform pause flow and auto-pausing Google Ads have not been implemented.
- Advertising data sync is presently a snapshot, not a continuous background sync. Do not use recorded balance as proof that the platform can never overspend the authorised limit.
