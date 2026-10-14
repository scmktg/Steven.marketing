-- Applied to Supabase project txzaubnzumdcnshocjzz on 14 October 2026.
-- Agency-wide administrator role; database-console assignment only.
create table if not exists public.agency_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.agency_admins enable row level security;
revoke all on public.agency_admins from anon, authenticated;
grant select on public.agency_admins to authenticated;
create policy "Agency admins may verify own role" on public.agency_admins
  for select to authenticated using (user_id = (select auth.uid()));

create policy "Agency read clients" on public.clients for select to authenticated using
  (exists(select 1 from public.agency_admins a where a.user_id = (select auth.uid())));
create policy "Agency read memberships" on public.client_memberships for select to authenticated using
  (exists(select 1 from public.agency_admins a where a.user_id = (select auth.uid())));
create policy "Agency read terms" on public.client_terms for select to authenticated using
  (exists(select 1 from public.agency_admins a where a.user_id = (select auth.uid())));
create policy "Agency read monthly metrics" on public.client_monthly_metrics for select to authenticated using
  (exists(select 1 from public.agency_admins a where a.user_id = (select auth.uid())));
create policy "Agency read invoices" on public.client_invoices for select to authenticated using
  (exists(select 1 from public.agency_admins a where a.user_id = (select auth.uid())));

grant insert,update,delete on public.clients,public.client_memberships,public.client_terms,
  public.client_invoices to authenticated;
create policy "Agency insert clients" on public.clients for insert to authenticated with check
  (exists(select 1 from public.agency_admins a where a.user_id = (select auth.uid())));
create policy "Agency update clients" on public.clients for update to authenticated
  using (exists(select 1 from public.agency_admins a where a.user_id = (select auth.uid())))
  with check (exists(select 1 from public.agency_admins a where a.user_id = (select auth.uid())));
create policy "Agency add memberships" on public.client_memberships for insert to authenticated with check
  (exists(select 1 from public.agency_admins a where a.user_id = (select auth.uid())));
create policy "Agency update memberships" on public.client_memberships for update to authenticated
  using (exists(select 1 from public.agency_admins a where a.user_id = (select auth.uid())))
  with check (exists(select 1 from public.agency_admins a where a.user_id = (select auth.uid())));
create policy "Agency remove memberships" on public.client_memberships for delete to authenticated
  using (exists(select 1 from public.agency_admins a where a.user_id = (select auth.uid())));
create policy "Agency add terms" on public.client_terms for insert to authenticated with check
  (exists(select 1 from public.agency_admins a where a.user_id = (select auth.uid())));
create policy "Agency update terms" on public.client_terms for update to authenticated
  using (exists(select 1 from public.agency_admins a where a.user_id = (select auth.uid())))
  with check (exists(select 1 from public.agency_admins a where a.user_id = (select auth.uid())));
create policy "Agency add invoices" on public.client_invoices for insert to authenticated with check
  (exists(select 1 from public.agency_admins a where a.user_id = (select auth.uid())));
create policy "Agency update invoices" on public.client_invoices for update to authenticated
  using (exists(select 1 from public.agency_admins a where a.user_id = (select auth.uid())))
  with check (exists(select 1 from public.agency_admins a where a.user_id = (select auth.uid())));
comment on table public.agency_admins is 'Highly privileged agency administrators. Grant only by SQL after independently verifying identity.';
