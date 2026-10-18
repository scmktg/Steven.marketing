-- Draft deployment migration. Do not apply before a complete authenticated
-- signing workflow and migration tests have been reviewed.
-- A document identity must never be inferred from a user-submitted URL.
alter table public.client_agreements
  add column if not exists signwell_document_id text,
  add column if not exists signer_client_email text,
  add column if not exists signer_agency_email text,
  add column if not exists signwell_completed_at timestamptz;

create unique index if not exists client_agreements_signwell_document_unique
  on public.client_agreements(signwell_document_id)
  where signwell_document_id is not null;

-- A completed record must be anchored to a known SignWell envelope and
-- exact expected recipient identities, in addition to the saved evidence.
alter table public.client_agreements
  add constraint signed_agreement_has_verified_envelope
  check (
    status <> 'signed' OR (
      signwell_document_id IS NOT NULL
      AND signer_client_email IS NOT NULL
      AND signer_agency_email IS NOT NULL
      AND signwell_completed_at IS NOT NULL
    )
  );

-- Client-account onboarding should be invite-only, and being listed in a
-- membership does not itself prove contract acceptance. Apply the
-- restrictive reporting migration in the same controlled deployment.
