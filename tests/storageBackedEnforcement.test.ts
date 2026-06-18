import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  FileConsentLedger,
  recordConsentGrant,
  recordConsentRevocation
} from "../src/privacy/consentLedger";
import { SovereignFetch, type MinimalFetchResponse } from "../src/privacy/sovereignFetch";
import { buildStorageBackedEnforcementReport } from "../src/evals/storageBackedEnforcementReport";
import { getScenarioById, scenarios } from "../src/scenarios/library";

describe("storage-backed runtime enforcement", () => {
  it("persists consent, blocks disallowed egress before fetch, and honors revocation", async () => {
    const dir = await mkdtemp(join(tmpdir(), "paisl-ledger-"));
    try {
      const scenario = getScenarioById("subscription-negotiation");
      const ledger = new FileConsentLedger(join(dir, "consent.jsonl"));
      const auditLog = join(dir, "egress.jsonl");
      let fetchCalls = 0;
      const fetchImpl = async (): Promise<MinimalFetchResponse> => {
        fetchCalls += 1;
        return {
          status: 202,
          async text(): Promise<string> {
            return "accepted";
          }
        };
      };
      const sovereignFetch = new SovereignFetch(
        ledger,
        auditLog,
        fetchImpl,
        new Set(["provider.example"])
      );

      await ledger.reset();
      const receipt = await recordConsentGrant(
        ledger,
        scenario,
        "negotiation-payload",
        "federated",
        "minimized_payload",
        "Provider-facing negotiation payload."
      );

      const allowed = await sovereignFetch.request({
        id: "allowed",
        scenario,
        dataItemId: "negotiation-payload",
        targetLayer: "federated",
        targetUrl: "https://provider.example/negotiation",
        releaseForm: "minimized_payload",
        purpose: "Provider-facing negotiation payload.",
        attemptedAt: "2026-05-22T00:00:00.000Z",
        payload: { minimized: true }
      });
      const rawBlocked = await sovereignFetch.request({
        id: "raw-blocked",
        scenario,
        dataItemId: "willingness-to-pay",
        targetLayer: "federated",
        targetUrl: "https://provider.example/negotiation",
        releaseForm: "raw_payload",
        purpose: "Provider asks for the user's maximum willingness to pay.",
        attemptedAt: "2026-05-22T00:00:00.000Z",
        payload: { raw: "blocked" }
      });
      await recordConsentRevocation(
        ledger,
        receipt.id,
        "2026-05-22T01:00:00.000Z",
        "User revoked provider negotiation consent."
      );
      const revokedBlocked = await sovereignFetch.request({
        id: "revoked-blocked",
        scenario,
        dataItemId: "negotiation-payload",
        targetLayer: "federated",
        targetUrl: "https://provider.example/negotiation",
        releaseForm: "minimized_payload",
        purpose: "Provider-facing negotiation payload.",
        attemptedAt: "2026-05-22T01:01:00.000Z",
        payload: { minimized: true }
      });

      expect(allowed.allowed).toBe(true);
      expect(rawBlocked.allowed).toBe(false);
      expect(revokedBlocked.allowed).toBe(false);
      expect(fetchCalls).toBe(1);
      expect((await readFile(auditLog, "utf8")).trim().split("\n")).toHaveLength(3);
      expect(await ledger.listEvents()).toHaveLength(2);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("generates a passing storage-backed enforcement report", async () => {
    const report = await buildStorageBackedEnforcementReport(join(tmpdir(), "paisl-report-test"), scenarios);

    expect(report.failed).toBe(0);
    expect(report.passed).toBe(report.probeCount);
    expect(report.ledgerEventCount).toBe(2);
    expect(report.auditEventCount).toBe(4);
    expect(report.probes.some((probe) => probe.controls.includes("network:host-deny"))).toBe(true);
  });
});
