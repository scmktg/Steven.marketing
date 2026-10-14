# steven.marketing

A lightweight public website and invite-only private client dashboard built on Next.js 15 and Supabase Auth/Postgres.

## What is implemented

- Branded email/password sign-in, recovery email and password reset (when a dedicated Supabase backend is configured)
- SSR session refresh and verified JWT claims on protected routes
- Organisation-scoped client access, enforced with Supabase Postgres row-level security (RLS)
- Five private areas: Overview, Sales, Advertising, Commissions and Invoices
- Per-client baseline and commission rates, including a separate manual calculation option
- Verified-source timestamps for Shopify and Google Ads; never invents figures or infers ROAS from unrelated datasets
- Read-only portal: sales, ad spending, agreements and invoices are populated by separately authorised administration/integration jobs
- Responsive, monochrome, accessible, minimal UI

## Required activation (no database was assigned automatically)

**Supabase project selected:** `Steven-marketing` (`txzaubnzumdcnshocjzz`). Database schema was applied and RLS permissions verified on 14 October 2026. Keep the unrelated `458` project separate.

**Vercel activation:** Set `NEXT_PUBLIC_SUPABASE_URL` to `https://txzaubnzumdcnshocjzz.supabase.co` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the new project's publishable key for all desired environments. Deploy after saving variables: Next.js embeds `NEXT_PUBLIC_` values in the frontend at build time.

**Authentication activation:** In Supabase Authentication → Providers → Email, disable public user sign-ups. Set Site URL to `https://steven.marketing` and allow `https://steven.marketing/auth/callback` for recovery and invitation redirects. Invite users with Supabase Auth's admin UI. No test accounts or credentials are committed here.

**First client:** Assign authenticated users a `client_memberships` entry via a secure admin workflow. Without a membership, the app intentionally shows an unassigned workspace. Do not populate sales/ads or commissions until validated against each agreement.

1. Create a Supabase project in the appropriate organisation and Australian region. Apply `supabase/schema.sql` with its SQL Editor.
2. In Supabase Authentication, disable public email self-registration. Use the Auth dashboard/admin-only invitations to create client accounts. Configure email provider, login rate limits and allowed redirect URLs (production: `https://steven.marketing/auth/callback` and `https://steven.marketing/reset-password`; include preview/local URLs only for trusted environments).
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in Vercel for this project (production/preview as appropriate). These values are publishable; **never** put a service-role or secret key in NEXT_PUBLIC variables.
4. Deploy and validate an invited login, redirect/cookie lifecycle, sign-out, a password reset, and a user with no membership.
5. Create `clients` and `client_memberships` for authorised users using the Supabase SQL Editor or secured admin process. For example, after inviting a user:
   ```sql
   insert into public.clients (name, slug) values ('Example Client','example-client');
   insert into public.client_memberships (client_id, user_id, role)
   select c.id, u.id, 'owner'
   from public.clients c cross join auth.users u
   where c.slug = 'example-client' and u.email = 'invited@example.com';
   ```
   The above is a template only; it is not executed and must be adapted before use.
6. Create one `client_terms` row per client. For revenue growth, configure baseline and rate explicitly (rate 0.15 means 15%). Add verified `client_monthly_metrics` rows and `client_invoices` only when real figures are available.
7. Wire up private Shopify and Google Ads import jobs and invoice provider integration before announcing real-time reporting. No raw API secrets, admin write capability or Shopify/Ads connectors are exposed to client browsers.

## Calculations and commercial caveats

The current estimate for a revenue-growth agreement is `max(0, net_sales_aud - baseline_monthly_aud) * commission_rate`. For any other arrangement use the `manual` model. Estimates are labelled provisional: contract-specific revenue exclusions, refunds, credits, tax treatment and settlement rules must be implemented before using them for billing. Invoices are authoritative. ROAS is intentionally not computed from independent Google Ads spend and Shopify revenue.

## Development

Node 20+. `npm install`, `npm run build`, `npm run dev`. Use `.env.example` as a reference. Without Supabase environment variables, the public website still renders and the login page clearly reports that client access is not yet configured.

## Security

All private data loading is server-side and requires validated Auth claims. Supabase RLS restricts each table to authorised members of that client. Public users cannot self-register or mutate client metrics through the Data API. Do not copy sample credentials, real customer data or secrets into the repository. Perform a multi-tenant authorization test before launch.
