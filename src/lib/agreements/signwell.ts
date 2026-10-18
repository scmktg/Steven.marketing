import "server-only";

const BASE_URL = "https://www.signwell.com/api/v1";

/** Approved SignWell Marketing Partnership Agreement template. Not a credential. */
export const SIGNWELL_MARKETING_TEMPLATE_ID = "yiguVRdwPMumuucJ";

export const SIGNWELL_SIGNER_PLACEHOLDERS = {
  agency: "Document Sender",
  client: "Client",
} as const;

type SignWellRecipient = {
  id: string;
  placeholder_name: string;
  name: string;
  email: string;
};

type SignWellDocument = {
  id: string;
  status?: string;
  test_mode?: boolean;
  completed?: boolean;
  recipients?: Array<{
    status?: string;
    placeholder_name?: string;
    id?: string;
    email?: string;
    name?: string;
    embedded_signing_url?: string;
  }>;
  metadata?: Record<string, unknown>;
};

/**
 * Restricted SignWell API client. Credentials are never sent to browsers.
 * The caller must authenticate the agency administrator and validate that
 * the approved agreement version and recipient belong to the client before
 * calling createAgreementFromTemplate.
 */
async function signwellRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const key = process.env.SIGNWELL_API_KEY;
  if (!key) throw new Error("SignWell API is not configured");
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "X-Api-Key": key,
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    // Provider error body may contain document or client details: don't log it.
    throw new Error(`SignWell API request failed (HTTP ${response.status})`);
  }
  return response.json() as Promise<T>;
}

export async function createAgreementFromTemplate(input: {
  templateId: string;
  documentName: string;
  recipients: [SignWellRecipient, SignWellRecipient];
  agreementId: string;
  testMode: boolean;
}): Promise<{ documentId: string; embeddedSigningUrl: string }> {
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(input.templateId) ||
      !/^[0-9a-f-]{36}$/i.test(input.agreementId)) {
    throw new Error("Invalid agreement/template identifier");
  }
  if (input.recipients.some((r) => !r.email || !r.name || !r.placeholder_name || !r.id) ||
      input.recipients[0].placeholder_name !== SIGNWELL_SIGNER_PLACEHOLDERS.agency ||
      input.recipients[1].placeholder_name !== SIGNWELL_SIGNER_PLACEHOLDERS.client) {
    throw new Error("Two distinct template signers are required");
  }
  const result = await signwellRequest<SignWellDocument>("/document_templates/documents", {
    method: "POST",
    body: JSON.stringify({
      template_id: input.templateId,
      name: input.documentName,
      test_mode: input.testMode,
      embedded_signing: true,
      embedded_signing_notifications: true,
      draft: false,
      allow_reassign: false,
      recipients: input.recipients,
      metadata: { agreement_id: input.agreementId },
    }),
  });
  const recipient = result.recipients?.find(
    (item) => item.email?.toLowerCase() === input.recipients[1].email.toLowerCase(),
  );
  if (!result.id || !recipient?.embedded_signing_url) {
    throw new Error("SignWell did not return a signing session");
  }
  const url = new URL(recipient.embedded_signing_url);
  if (url.protocol !== "https:" || url.hostname !== "www.signwell.com") {
    throw new Error("Unexpected SignWell signing URL");
  }
  return { documentId: result.id, embeddedSigningUrl: url.toString() };
}

/** Always re-fetch document status from SignWell; redirect/callback is not proof. */
export async function fetchSignWellDocument(documentId: string): Promise<SignWellDocument> {
  if (!/^[0-9a-f-]{36}$/i.test(documentId)) throw new Error("Invalid document ID");
  return signwellRequest<SignWellDocument>(`/documents/${encodeURIComponent(documentId)}`);
}

/**
 * This predicate only checks the provider's live document data. Before
 * granting dashboard access the caller MUST ALSO compare the stored
 * document ID, signer email, template/version/hash, all required signers,
 * and persist signed PDF + audit evidence transactionally.
 */
export function isSignWellDocumentCompleted(document: SignWellDocument): boolean {
  return document.test_mode !== true && (document.completed === true || document.status === "completed") &&
    Boolean(document.recipients && document.recipients.length >= 2 &&
    document.recipients.every(recipient => recipient.status === "completed" || recipient.status === "signed"));
}
