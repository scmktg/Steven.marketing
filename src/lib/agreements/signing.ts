import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Provider-neutral webhook authentication. An adapter must verify its provider's
 * signature specification before normalising any completed-signature event.
 * This helper is suitable only for providers explicitly using HMAC-SHA256 of
 * the unmodified raw request body, expressed as lowercase hex.
 */
export function verifyHmacSha256(
  rawBody: string,
  suppliedDigest: string | null,
  secret: string | undefined,
): boolean {
  if (!secret || !suppliedDigest || !/^[a-f0-9]{64}$/i.test(suppliedDigest)) {
    return false;
  }
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const supplied = Buffer.from(suppliedDigest, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export type VerifiedSigningCompletion = {
  agreementId: string;
  providerEnvelopeId: string;
  providerEventId: string;
  signedByEmail: string;
  signedAt: string;
  signedDocumentSha256: string;
  evidenceStorageKey: string;
};

/**
 * Signature completion is only an attested fact after the signing provider
 * has authenticated the webhook and its signed-document/evidence artifacts
 * have been retrieved and checked server-side.
 *
 * Never populate this type from a client-submitted form or redirect query.
 */
export function isVerifiedSigningCompletion(
  value: unknown,
): value is VerifiedSigningCompletion {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.agreementId === "string" &&
    /^[0-9a-f-]{36}$/i.test(item.agreementId) &&
    typeof item.providerEnvelopeId === "string" &&
    item.providerEnvelopeId.length > 0 &&
    typeof item.providerEventId === "string" &&
    item.providerEventId.length > 0 &&
    typeof item.signedByEmail === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.signedByEmail) &&
    typeof item.signedAt === "string" &&
    Number.isFinite(Date.parse(item.signedAt)) &&
    typeof item.signedDocumentSha256 === "string" &&
    /^[a-f0-9]{64}$/i.test(item.signedDocumentSha256) &&
    typeof item.evidenceStorageKey === "string" &&
    item.evidenceStorageKey.length > 0
  );
}
