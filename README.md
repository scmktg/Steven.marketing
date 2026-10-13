# steven.marketing

A deliberately lightweight Next.js marketing site and future client-portal entry point.

## Development

Requires Node.js 20+. Run `npm install` then `npm run dev`. Verify with `npm run build`.

## What is live in this starter

- Responsive public landing page
- Client portal information page at `/login`
- Contact and request-access mail links

**Important:** No authentication is active. The login entry deliberately does not accept passwords or display invented client data.

## Future portal architecture

Add secure server-side authentication (e.g. Supabase Auth), per-client membership/roles with row-level security, and protected routes. Model each client's contractual commission method, baseline, rates, attribution rules, adjustments and invoice cycles explicitly. Ingest Shopify orders/refunds and Google Ads costs through server-side integrations and store sync provenance. Distinguish gross sales, net sales, ad-attributed conversion values and billable commission. Stripe hosted invoices/payment links can handle invoice settlement. Never expose API credentials in browser code.

Suggested protected routes after auth: `/dashboard`, `/dashboard/sales`, `/dashboard/advertising`, `/dashboard/commissions`, `/dashboard/invoices`. Confirm data sharing scope and contract formulas before production rollout.

## Deployment

Connect this GitHub repository to Vercel. Framework preset: Next.js. Point the domain `steven.marketing` at the project after verifying the deployment.

No environment variables are required for this public starter.
