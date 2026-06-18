import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FileConsentLedger } from "../src/privacy/consentLedger";
import { createConsentReceipt } from "../src/privacy/egressGuard";
import { getScenarioById } from "../src/scenarios/library";

async function seedLedger(): Promise<FileConsentLedger> {
  const dir = await mkdtemp(join(tmpdir(), "paisl-chain-"));
  const ledger = new FileConsentLedger(join(dir, "consent.jsonl"));
  const scenario = getScenarioById("subscription-negotiation");
  const item = scenario.dataItems[0];
  await ledger.append(
    "grant",
    {
      id: "r1",
      scenarioId: scenario.id,
      dataItemId: item.id,
      targetLayer: "personal_cloud",
      releaseForm: "minimized_payload",
      purpose: "test",
      grantedAt: "2026-05-22T00:00:00.000Z",
      expiresAt: "2026-06-22T00:00:00.000Z",
      status: "active",
      keyId: "k1",
      signature: "sig"
    } as never
  );
  await ledger.append(
    "grant",
    {
      id: "r2",
      scenarioId: scenario.id,
      dataItemId: item.id,
      targetLayer: "personal_cloud",
      releaseForm: "minimized_payload",
      purpose: "test-2",
      grantedAt: "2026-05-22T00:00:00.000Z",
      expiresAt: "2026-06-22T00:00:00.000Z",
      status: "active",
      keyId: "k1",
      signature: "sig"
    } as never
  );
  return ledger;
}

describe("consent ledger hash chain", () => {
  it("verifies an unbroken chain", async () => {
    const ledger = await seedLedger();
    const result = await ledger.verify();
    expect(result.valid).toBe(true);
  });

  it("detects reordering of events", async () => {
    const ledger = await seedLedger();
    const lines = (await readFile(ledger.path, "utf8")).trim().split("\n");
    // Swap the two events; per-event digests are intact but the chain breaks.
    await writeFile(ledger.path, `${lines[1]}\n${lines[0]}\n`);
    const result = await ledger.verify();
    expect(result.valid).toBe(false);
  });

  it("detects removal of an earlier event (gap in the chain)", async () => {
    const ledger = await seedLedger();
    const lines = (await readFile(ledger.path, "utf8")).trim().split("\n");
    // Drop the first (genesis-rooted) event. The survivor's previousDigest now
    // points at a digest that no longer begins the chain, so the gap is caught.
    await writeFile(ledger.path, `${lines[1]}\n`);
    expect((await ledger.verify()).valid).toBe(false);
  });

  it("does not let a later different-purpose receipt mask an earlier correct one", async () => {
    const dir = await mkdtemp(join(tmpdir(), "paisl-purpose-"));
    const ledger = new FileConsentLedger(join(dir, "consent.jsonl"));
    const scenario = getScenarioById("subscription-negotiation");
    const item =
      scenario.dataItems.find((candidate) => candidate.defaultBoundary === "requires_consent") ??
      scenario.dataItems[0];

    const receiptA = createConsentReceipt(scenario, item.id, "personal_cloud", "minimized_payload", "purpose-A");
    await ledger.append("grant", receiptA);
    // A later grant for the SAME scope but a different purpose must not shadow A.
    const receiptB = createConsentReceipt(scenario, item.id, "personal_cloud", "minimized_payload", "purpose-B");
    await ledger.append("grant", receiptB);

    const attemptA = {
      scenarioId: scenario.id,
      dataItemId: item.id,
      targetLayer: "personal_cloud" as const,
      releaseForm: "minimized_payload" as const,
      purpose: "purpose-A",
      attemptedAt: "2026-05-22T00:00:00.000Z",
      consentReceipt: receiptA
    };
    const found = await ledger.activeReceiptForAttempt(attemptA);
    expect(found?.purpose).toBe("purpose-A");
    expect(receiptA.id).not.toBe(receiptB.id);
  });

  it("detects an edited field", async () => {
    const ledger = await seedLedger();
    const raw = await readFile(ledger.path, "utf8");
    await writeFile(ledger.path, raw.replace("test-2", "tampered-purpose"));
    const result = await ledger.verify();
    expect(result.valid).toBe(false);
  });
});
