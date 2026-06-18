import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { ConsentReceipt } from "./egressGuard";
import { canonicalConsentPayload } from "./signedConsentReceipt";

export type CustodyKeyStatus = "active" | "retired" | "revoked";
export type CustodyEventType = "created" | "rotated" | "retired" | "revoked";

export interface CustodyKeyRecord {
  keyId: string;
  purpose: "consent_receipt_integrity";
  status: CustodyKeyStatus;
  createdAt: string;
  retiredAt: string | null;
  revokedAt: string | null;
  materialLabel: string;
  fixtureMaterial: string;
}

export interface CustodyLedgerEvent {
  id: string;
  timestamp: string;
  eventType: CustodyEventType;
  keyId: string;
  actor: "benchmark_custody_simulator";
  reason: string;
  previousDigest: string;
  eventDigest: string;
}

export interface CustodyLedger {
  keys: CustodyKeyRecord[];
  events: CustodyLedgerEvent[];
}

export interface CustodiedConsentEnvelope {
  receipt: ConsentReceipt;
  signedAt: string;
  signature: {
    algorithm: "HMAC-SHA256";
    keyId: string;
    custody: "deterministic_fixture_key_lifecycle";
    canonicalization: "json-stable-sort-v1";
    value: string;
  };
}

function sortForDigest(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortForDigest);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, sortForDigest(entry)])
    );
  }
  return value;
}

function canonicalDigestPayload(value: unknown): string {
  return JSON.stringify(sortForDigest(value));
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalDigestPayload(value)).digest("hex");
}

function eventDigest(event: Omit<CustodyLedgerEvent, "eventDigest">): string {
  return digest(event);
}

function statusFromEvent(eventType: CustodyEventType): CustodyKeyStatus {
  if (eventType === "retired") {
    return "retired";
  }
  if (eventType === "revoked") {
    return "revoked";
  }
  return "active";
}

function appendEvent(
  events: CustodyLedgerEvent[],
  event: Omit<CustodyLedgerEvent, "previousDigest" | "eventDigest">
): CustodyLedgerEvent {
  const previousDigest = events.at(-1)?.eventDigest ?? "GENESIS";
  const eventWithoutDigest = { ...event, previousDigest };
  const next = {
    ...eventWithoutDigest,
    eventDigest: eventDigest(eventWithoutDigest)
  };
  events.push(next);
  return next;
}

export function buildFixtureCustodyLedger(): CustodyLedger {
  const keys: CustodyKeyRecord[] = [
    {
      keyId: "paisl-consent-fixture-v1",
      purpose: "consent_receipt_integrity",
      status: "retired",
      createdAt: "2026-05-20T00:00:00.000Z",
      retiredAt: "2026-05-22T00:00:00.000Z",
      revokedAt: null,
      materialLabel: "public deterministic fixture, not a secret",
      fixtureMaterial: "paisl-public-fixture-custody-material-not-secret-v1"
    },
    {
      keyId: "paisl-consent-fixture-v2",
      purpose: "consent_receipt_integrity",
      status: "active",
      createdAt: "2026-05-22T00:00:00.000Z",
      retiredAt: null,
      revokedAt: null,
      materialLabel: "public deterministic fixture, not a secret",
      fixtureMaterial: "paisl-public-fixture-custody-material-not-secret-v2"
    },
    {
      keyId: "paisl-consent-fixture-revoked",
      purpose: "consent_receipt_integrity",
      status: "revoked",
      createdAt: "2026-05-21T00:00:00.000Z",
      retiredAt: null,
      revokedAt: "2026-05-22T00:30:00.000Z",
      materialLabel: "public deterministic fixture, not a secret",
      fixtureMaterial: "paisl-public-fixture-custody-material-not-secret-revoked"
    }
  ];
  const events: CustodyLedgerEvent[] = [];
  appendEvent(events, {
    id: "custody-event-001",
    timestamp: "2026-05-20T00:00:00.000Z",
    eventType: "created",
    keyId: "paisl-consent-fixture-v1",
    actor: "benchmark_custody_simulator",
    reason: "Initial consent receipt integrity key for historical receipt verification."
  });
  appendEvent(events, {
    id: "custody-event-002",
    timestamp: "2026-05-22T00:00:00.000Z",
    eventType: "rotated",
    keyId: "paisl-consent-fixture-v2",
    actor: "benchmark_custody_simulator",
    reason: "Rotate active signing to v2 while preserving historical v1 verification."
  });
  appendEvent(events, {
    id: "custody-event-003",
    timestamp: "2026-05-22T00:00:00.000Z",
    eventType: "retired",
    keyId: "paisl-consent-fixture-v1",
    actor: "benchmark_custody_simulator",
    reason: "Retire v1 for new consent receipts after rotation."
  });
  appendEvent(events, {
    id: "custody-event-004",
    timestamp: "2026-05-22T00:30:00.000Z",
    eventType: "revoked",
    keyId: "paisl-consent-fixture-revoked",
    actor: "benchmark_custody_simulator",
    reason: "Revoked key simulates compromise handling and must not authorize new receipts."
  });

  return { keys, events };
}

export function verifyCustodyLedger(ledger: CustodyLedger): { valid: boolean; reason: string } {
  let previousDigest = "GENESIS";
  const eventStatusByKey = new Map<string, CustodyKeyStatus>();
  for (const event of ledger.events) {
    if (event.previousDigest !== previousDigest) {
      return {
        valid: false,
        reason: `Event ${event.id} points to ${event.previousDigest}, expected ${previousDigest}.`
      };
    }
    const { eventDigest: observedDigest, ...eventWithoutDigest } = event;
    const expectedDigest = eventDigest(eventWithoutDigest);
    if (observedDigest !== expectedDigest) {
      return {
        valid: false,
        reason: `Event ${event.id} digest mismatch.`
      };
    }
    eventStatusByKey.set(event.keyId, statusFromEvent(event.eventType));
    previousDigest = observedDigest;
  }

  for (const key of ledger.keys) {
    const eventStatus = eventStatusByKey.get(key.keyId);
    if (!eventStatus) {
      return { valid: false, reason: `Custody key ${key.keyId} has no lifecycle event.` };
    }
    if (eventStatus !== key.status) {
      return {
        valid: false,
        reason: `Custody key ${key.keyId} status is ${key.status}, expected ${eventStatus}.`
      };
    }
  }

  return { valid: true, reason: "Custody event hash chain is intact." };
}

export function selectActiveCustodyKey(ledger: CustodyLedger): CustodyKeyRecord | null {
  const activeKeys = ledger.keys
    .filter((key) => key.status === "active")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return activeKeys[0] ?? null;
}

export function authorizeNewConsentSigning(
  ledger: CustodyLedger,
  keyId: string
): { allowed: boolean; reason: string } {
  const chain = verifyCustodyLedger(ledger);
  if (!chain.valid) {
    return { allowed: false, reason: chain.reason };
  }
  const key = ledger.keys.find((candidate) => candidate.keyId === keyId);
  if (!key) {
    return { allowed: false, reason: `Unknown custody key ${keyId}.` };
  }
  if (key.status !== "active") {
    return { allowed: false, reason: `Custody key ${keyId} is ${key.status}.` };
  }
  return { allowed: true, reason: `Custody key ${keyId} is active for new consent receipts.` };
}

function hmacReceipt(receipt: ConsentReceipt, key: CustodyKeyRecord, signedAt: string): string {
  return createHmac("sha256", key.fixtureMaterial)
    .update(`${canonicalConsentPayload(receipt)}|${signedAt}`)
    .digest("hex");
}

export function signCustodiedConsentReceipt(
  ledger: CustodyLedger,
  keyId: string,
  receipt: ConsentReceipt,
  signedAt: string
): CustodiedConsentEnvelope {
  const authorization = authorizeNewConsentSigning(ledger, keyId);
  if (!authorization.allowed) {
    throw new Error(authorization.reason);
  }
  const key = ledger.keys.find((candidate) => candidate.keyId === keyId);
  if (!key) {
    throw new Error(`Unknown custody key ${keyId}.`);
  }

  return {
    receipt,
    signedAt,
    signature: {
      algorithm: "HMAC-SHA256",
      keyId,
      custody: "deterministic_fixture_key_lifecycle",
      canonicalization: "json-stable-sort-v1",
      value: hmacReceipt(receipt, key, signedAt)
    }
  };
}

export function signHistoricalCustodiedReceipt(
  ledger: CustodyLedger,
  keyId: string,
  receipt: ConsentReceipt,
  signedAt: string
): CustodiedConsentEnvelope {
  const key = ledger.keys.find((candidate) => candidate.keyId === keyId);
  if (!key) {
    throw new Error(`Unknown custody key ${keyId}.`);
  }

  return {
    receipt,
    signedAt,
    signature: {
      algorithm: "HMAC-SHA256",
      keyId,
      custody: "deterministic_fixture_key_lifecycle",
      canonicalization: "json-stable-sort-v1",
      value: hmacReceipt(receipt, key, signedAt)
    }
  };
}

export function verifyCustodiedConsentReceipt(
  ledger: CustodyLedger,
  envelope: CustodiedConsentEnvelope
): { valid: boolean; reason: string } {
  const chain = verifyCustodyLedger(ledger);
  if (!chain.valid) {
    return { valid: false, reason: chain.reason };
  }
  const key = ledger.keys.find((candidate) => candidate.keyId === envelope.signature.keyId);
  if (!key) {
    return { valid: false, reason: `Unknown custody key ${envelope.signature.keyId}.` };
  }
  if (key.status === "revoked") {
    return { valid: false, reason: `Custody key ${key.keyId} has been revoked.` };
  }
  const expected = hmacReceipt(envelope.receipt, key, envelope.signedAt);
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(envelope.signature.value, "hex");
  const valid =
    actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);

  return valid
    ? {
        valid: true,
        reason: `Receipt signature verifies under custody key ${key.keyId} with status ${key.status}.`
      }
    : { valid: false, reason: "Custodied consent envelope signature mismatch." };
}
