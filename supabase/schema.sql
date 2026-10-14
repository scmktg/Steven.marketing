-- steven.marketing client portal. Apply to a dedicated Supabase project.
-- No sample, demo or customer data is inserted by this schema.
create extension if not exists pgcrypto;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at timestamptz not null default now()
);

create table if not exists public.client_memberships (
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('viewer','owner','agency')),
  created_at timestamptz not null default now(),
  primary key (client_id, user_id)
);
create index if not exists client_memberships_user_id_idx on public.client_memberships(user_id);

create table if not exists public.client_terms (
  client_id uuid primary key references public.clients(id) on delete cascade,
  commission_model text not null check (commission_model in ('revenue_growth','manual')),
  baseline_monthly_aud numeric(14,2) check (baseline_monthly_aud >= 0),
  commission_rate numeric(6,5) check (commission_rate >= 0 and commission_rate <= 1),
  updated_at timestamptz not null default now(),
  constraint revenue_growth_terms_complete check (
    commission_model = 'manual' or (baseline_monthly_aud is not null and commission_rate is not null)
  )
);

create table if not exists public.client_monthly_metrics (
  client_id uuid not null references public.clients(id) on delete cascade,
  month date not null check (extract(day from month)=1),
  gross_sales_aud numeric(14,2) check (gross_sales_aud >= 0),
  net_sales_aud numeric(14,2),
  orders integer check (orders >= 0),
  ad_spend_aud numeric(14,2) check (ad_spend_aud >= 0),
  shopify_synced_at timestamptz,
  ads_synced_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(client_id, month)
);
create index if not exists client_monthly_metrics_period_idx on public.client_monthly_metrics(month desc);

create table if not exists public.client_invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  number text not null,
  issued_on date,
  due_on date,
  amount_aud numeric(14,2) not null check (amount_aud >= 0),
  status text not null default 'draft' check (status in ('draft','issued','paid','overdue','void')),
  hosted_invoice_url text check (hosted_invoice_url is null or hosted_invoice_url ~ '^https://'),
  created_at timestamptz not null default now(),
  unique(client_id, number)
);
create index if not exists client_invoices_client_issued_idx on public.client_invoices(client_id, issued_on desc);

-- Protect every table exposed by the Supabase Data API.
alter table public.clients enable row level security;
alter table public.client_memberships enable row level security;
alter table public.client_terms enable row level security;
alter table public.client_monthly_metrics enable row level security;
alter table public.client_invoices enable row level security;

-- No client-side writes. Agency integrations must use separately secured back-end jobs.
revoke all on public.clients, public.client_memberships, public.client_terms,
  public.client_monthly_metrics, public.client_invoices from anon, authenticated;
grant select on public.clients, public.client_memberships, public.client_terms,
  public.client_monthly_metrics, public.client_invoices to authenticated;

create policy "Members see their own membership" on public.client_memberships for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Members see their clients" on public.clients for select to authenticated
  using (exists (
    select 1 from public.client_memberships m
    where m.client_id = id and m.user_id = (select auth.uid())
  ));

create policy "Members see their terms" on public.client_terms for select to authenticated
  using (exists (
    select 1 from public.client_memberships m
    where m.client_id = client_terms.client_id and m.user_id = (select auth.uid())
  ));

create policy "Members see their metrics" on public.client_monthly_metrics for select to authenticated
  using (exists (
    select 1 from public.client_memberships m
    where m.client_id = client_monthly_metrics.client_id and m.user_id = (select auth.uid())
  ));

create policy "Members see their invoices" on public.client_invoices for select to authenticated
  using (exists (
    select 1 from public.client_memberships m
    where m.client_id = client_invoices.client_id and m.user_id = (select auth.uid())
  ));

comment on table public.client_monthly_metrics is
  'Month-level reporting snapshots. Net sales must use the client-approved revenue definition, not Google Ads conversion value.';
comment on table public.client_terms is
  'Portal display terms only; signed agreements and adjustments take precedence for billing.';
