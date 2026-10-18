# SignWell onboarding integration — implementation status

The repository contains a server-only SignWell client at `src/lib/agreements/signwell.ts`.
This code is **not yet wired to the agency UI** and **does not grant access**.
The agreement migration in `supabase/migrations/20261019_client_agreement_foundation.sql`
has not been applied as part of this change.

## Secret configuration
Set `SIGNWELL_API_KEY` in Vercel's server environment settings.
Never prefix it with `NEXT_PUBLIC_`; never commit or send the key in chat.
Do not deploy with an API key until endpoint permissions are verified.

## Template setup
Create and approve a final Marketing Partnership Agreement template in SignWell.
The client signer placeholder and its required signature fields must be configured.
The template ID (UUID) may be stored as a server-side configuration setting.
Where the agreement contains client-specific financial terms, generate an
immutable per-client copy and verify its contents before requesting a signature.
**Do not assume that the agreement displayed in the existing admin UI is
identical to the SignWell template** without checking.

## Safe completion sequence
1. Agency admin (verified via `agency_admins`) chooses one client and version.
2. Store final agreement snapshot + SHA-256 privately, with agreed signer email.
3. Create a SignWell document from the approved template (test mode first).
4. Persist the returned SignWell document ID against the exact agreement row.
   If persistence fails, reconcile or cancel the orphan document.
5. Only the authenticated intended signer may open the embedded signing URL;
   never expose the URL in public pages or logs.
6. A SignWell `document_completed` webhook is a hint to reconcile; do not
   trust unauthenticated webhook JSON as signing evidence.
7. Independently fetch the exact document using server-side API credentials.
   Compare stored document ID, recipient identity, completion status, and
   approved document version. Retrieve the completed PDF and audit evidence.
8. Complete an idempotent backend transaction that persists verification and
   grants access to only the intended organisation. Enforce the gate in both
   route handlers and database policies; do not rely on UI redirects.
9. Test signature retries, duplicate events, declines, expired documents,
   wrong signer, additional signers, tenant boundaries, replay and failure.

## Important
Embedded signing disables SignWell email authentication. The steven.marketing
login session must establish signer identity prior to launching an embedded
signing URL. If an additional identity check is needed for the contract,
choose SignWell-hosted email-authenticated signing instead.

SignWell test_mode documents are not legally binding. Disable test_mode
only after end-to-end verification.

API docs:
- https://developers.signwell.com/reference/createdocumentfromtemplate
- https://developers.signwell.com/reference/getdocument
- https://developers.signwell.com/reference/events
- https://developers.signwell.com/reference/embedded-iframe
