-- Foundation for client agreement onboarding.
-- Apply to the dedicated Steven-marketing Supabase project only after review.
-- Does NOT itself grant dashboard access or record a legally valid signature.
-- Signature finalisation must occur in a verified, server-side transaction.
create table if not exists public.client_agreements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  version integer not null check (version > 0),
  title text not null check (length(trim(title)) > 0),
  -- Immutable rendered agreement stored in a private, access-controlled store.
  document_storage_key text not null check (length(trim(document_storage_key)) > 0),
  document_sha256 text not null check (document_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'draft' check (status in ('draft','issued','signed','void')),
  issued_at timestamptz,
  signed_at timestamptz,
  signed_by uuid references auth.users(id),
  -- Provider-specific evidence key. Never store signature links, tokens, or raw IPs in this table.
  signing_evidence_key text,
  created_at timestamptz not null default now(),
  unique(client_id, version),
  constraint agreement_state_consistency check (
    (status = 'draft' and issued_at is null and signed_at is null and signed_by is null and signing_evidence_key is null)
    or (status in ('issued','void') and issued_at is not null and signed_at is null and signed_by is null and signing_evidence_key is null)
    or (status = 'signed' and issued_at is not null and signed_at is not null
       and signed_by is not null and signing_evidence_key is not null)
  )
);

create index if not exists client_agreements_client_status_idx
  on public.client_agreements(client_id, status, version desc);

alter table public.client_agreements enable row level security;
revoke all on public.client_agreements from anon, authenticated;
grant select on public.client_agreements to authenticated;

-- Members can see issued or signed agreements for only their own organisation.
-- Draft and void agreements are restricted to agency administrators.
create policy "Client read issued or signed agreements"
  on public.client_agreements for select to authenticated
  using (
    status in ('issued','signed') and
    exists (
      select 1 from public.client_memberships m
      where m.client_id = client_agreements.client_id
      and m.user_id = (select auth.uid())
    )
  );

create policy "Agency administrators read agreements"
  on public.client_agreements for select to authenticated
  using (
    exists (
      select 1 from public.agency_admins a
      where a.user_id = (select auth.uid())
    )
  );

-- No Data API insert/update/delete grants: signature and issuance writes must
-- be performed by a trusted backend after identity and document verification.
-- In particular, a browser must never be allowed to set status='signed'.
comment on table public.client_agreements is
  'Versioned agreement metadata. Signature verification, audit evidence and immutable private document storage must be implemented before enabling contract activation.';
