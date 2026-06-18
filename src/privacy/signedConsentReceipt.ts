import { createHmac, timingSafeEqual } from "node:crypto";
import type { ConsentReceipt } from "./egressGuard";

export interface SignedConsentReceipt {
  receipt: ConsentReceipt;
  signature: {
    algorithm: "HMAC-SHA256";
    keyId: string;
    canonicalization: "json-stable-sort-v1";
    value: string;
  };
}

const FIXTURE_SIGNING_KEY = "paisl-public-fixture-signing-key-not-secret-v1";
const DEFAULT_KEY_ID = "paisl-fixture-hmac-key-v1";

function sortForSignature(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortForSignature);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, sortForSignature(entry)])
    );
  }
  return value;
}

export function canonicalConsentPayload(receipt: ConsentReceipt): string {
  return JSON.stringify(sortForSignature(receipt));
}

function signPayload(payload: string): string {
  return createHmac("sha256", FIXTURE_SIGNING_KEY).update(payload).digest("hex");
}

export function signConsentReceipt(
  receipt: ConsentReceipt,
  keyId = DEFAULT_KEY_ID
): SignedConsentReceipt {
  return {
    receipt,
    signature: {
      algorithm: "HMAC-SHA256",
      keyId,
      canonicalization: "json-stable-sort-v1",
      value: signPayload(canonicalConsentPayload(receipt))
    }
  };
}

export function verifySignedConsentReceipt(signed: SignedConsentReceipt): {
  valid: boolean;
  reason: string;
} {
  if (signed.signature.algorithm !== "HMAC-SHA256") {
    return { valid: false, reason: "Unsupported consent receipt signature algorithm." };
  }
  if (signed.signature.canonicalization !== "json-stable-sort-v1") {
    return { valid: false, reason: "Unsupported consent receipt canonicalization." };
  }

  const expected = signPayload(canonicalConsentPayload(signed.receipt));
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(signed.signature.value, "hex");
  const valid =
    actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);

  return valid
    ? { valid: true, reason: "Consent receipt signature is valid for the canonical payload." }
    : { valid: false, reason: "Consent receipt signature does not match the canonical payload." };
}

export function tamperSignedConsentReceipt(
  signed: SignedConsentReceipt,
  patch: Partial<ConsentReceipt>
): SignedConsentReceipt {
  return {
    receipt: {
      ...signed.receipt,
      ...patch
    },
    signature: signed.signature
  };
}
