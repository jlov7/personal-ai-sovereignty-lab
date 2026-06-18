import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname } from "node:path";
import {
  createConsentReceipt,
  revokeConsentReceipt,
  type ConsentReceipt,
  type EgressAttempt,
  type ReleaseForm
} from "./egressGuard";
import type { LayerId, Scenario } from "../shared/types";

export type ConsentLedgerEventType = "grant" | "revoke";

export interface ConsentLedgerEvent {
  id: string;
  sequence: number;
  eventType: ConsentLedgerEventType;
  recordedAt: string;
  receipt: ConsentReceipt;
  reason?: string;
  /** Digest of the previous event, chaining records so deletion, reordering, or
   * truncation of the append-only log is detectable. "GENESIS" for the first. */
  previousDigest: string;
  digest: string;
}

const GENESIS_DIGEST = "GENESIS";

const FIXED_RECORDED_AT = "2026-05-22T00:00:00.000Z";

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

function canonical(value: unknown): string {
  return JSON.stringify(sortForDigest(value));
}

function eventDigest(event: Omit<ConsentLedgerEvent, "digest">): string {
  return createHash("sha256").update(canonical(event)).digest("hex");
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function scopeMatches(receipt: ConsentReceipt, attempt: EgressAttempt): boolean {
  return (
    receipt.scenarioId === attempt.scenarioId &&
    receipt.dataItemId === attempt.dataItemId &&
    receipt.targetLayer === attempt.targetLayer &&
    receipt.releaseForm === attempt.releaseForm &&
    receipt.purpose === attempt.purpose
  );
}

export class FileConsentLedger {
  constructor(readonly path: string) {}

  async reset(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, "");
  }

  async listEvents(): Promise<ConsentLedgerEvent[]> {
    let contents = "";
    try {
      contents = await readFile(this.path, "utf8");
    } catch (error: unknown) {
      if (isMissingFile(error)) {
        return [];
      }
      throw error;
    }

    return contents
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as ConsentLedgerEvent);
  }

  async append(
    eventType: ConsentLedgerEventType,
    receipt: ConsentReceipt,
    options: { recordedAt?: string; reason?: string } = {}
  ): Promise<ConsentLedgerEvent> {
    await mkdir(dirname(this.path), { recursive: true });
    const existing = await this.listEvents();
    const sequence = existing.length + 1;
    const fields: Omit<ConsentLedgerEvent, "digest"> = {
      id: `consent_event_${sequence.toString().padStart(4, "0")}`,
      sequence,
      eventType,
      recordedAt: options.recordedAt ?? FIXED_RECORDED_AT,
      receipt,
      reason: options.reason,
      previousDigest: existing.at(-1)?.digest ?? GENESIS_DIGEST
    };
    const event = {
      ...fields,
      digest: eventDigest(fields)
    };

    await appendFile(this.path, `${JSON.stringify(event)}\n`);
    return event;
  }

  /** Walks the hash chain and verifies each record commits to the previous
   * digest and matches its own recomputed digest. Detects deletion, reordering,
   * gaps, and field edits to any non-tail record. Like any unsigned hash chain,
   * an edit to the latest record with a recomputed digest is not detectable
   * here; that case is covered by the separate keyed-integrity receipt layer. */
  async verify(): Promise<{ valid: boolean; reason: string }> {
    const events = await this.listEvents();
    let previousDigest = GENESIS_DIGEST;
    for (const event of events) {
      if (event.previousDigest !== previousDigest) {
        return {
          valid: false,
          reason: `Event ${event.id} points to ${event.previousDigest}, expected ${previousDigest}.`
        };
      }
      const { digest, ...withoutDigest } = event;
      if (eventDigest(withoutDigest) !== digest) {
        return { valid: false, reason: `Event ${event.id} digest mismatch.` };
      }
      previousDigest = digest;
    }
    return {
      valid: true,
      reason: `${events.length} consent event(s) form an unbroken hash chain.`
    };
  }

  async latestReceipt(receiptId: string): Promise<ConsentReceipt | undefined> {
    const events = await this.listEvents();
    return [...events].reverse().find((event) => event.receipt.id === receiptId)?.receipt;
  }

  async activeReceiptForAttempt(attempt: EgressAttempt): Promise<ConsentReceipt | undefined> {
    const events = await this.listEvents();
    const latest = [...events]
      .reverse()
      .find((event) => scopeMatches(event.receipt, attempt))?.receipt;

    return latest?.status === "active" ? latest : undefined;
  }
}

export async function recordConsentGrant(
  ledger: FileConsentLedger,
  scenario: Scenario,
  dataItemId: string,
  targetLayer: LayerId,
  releaseForm: ReleaseForm,
  purpose: string,
  options: { grantedAt?: string; ttlDays?: number; recordedAt?: string } = {}
): Promise<ConsentReceipt> {
  const receipt = createConsentReceipt(scenario, dataItemId, targetLayer, releaseForm, purpose, {
    grantedAt: options.grantedAt,
    ttlDays: options.ttlDays
  });
  await ledger.append("grant", receipt, { recordedAt: options.recordedAt });
  return receipt;
}

export async function recordConsentRevocation(
  ledger: FileConsentLedger,
  receiptId: string,
  revokedAt: string,
  reason: string
): Promise<ConsentReceipt> {
  const receipt = await ledger.latestReceipt(receiptId);
  if (!receipt) {
    throw new Error(`Cannot revoke unknown consent receipt ${receiptId}`);
  }

  const revoked = revokeConsentReceipt(receipt, revokedAt, reason);
  await ledger.append("revoke", revoked, { recordedAt: revokedAt, reason });
  return revoked;
}
