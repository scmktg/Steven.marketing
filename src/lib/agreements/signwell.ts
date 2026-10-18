import "server-only";

const BASE_URL = "https://www.signwell.com/api/v1";

type SignWellRecipient = {
  id: string;
  placeholder_name: string;
  name: string;
  email: string;
};

type SignWellDocument = {
  id: string;
  status?: string;
  completed?: boolean;
  recipients?: Array<{
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
  recipient: SignWellRecipient;
  agreementId: string;
  testMode: boolean;
}): Promise<{ documentId: string; embeddedSigningUrl: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(input.templateId) ||
      !/^[0-9a-f-]{36}$/i.test(input.agreementId)) {
    throw new Error("Invalid agreement/template identifier");
  }
  if (!input.recipient.email || !input.recipient.name ||
      !input.recipient.placeholder_name) throw new Error("Missing signer");
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
      recipients: [input.recipient],
      metadata: { agreement_id: input.agreementId },
    }),
  });
  const recipient = result.recipients?.find(
    (item) => item.email?.toLowerCase() === input.recipient.email.toLowerCase(),
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
  return document.completed === true || document.status === "completed";
}
