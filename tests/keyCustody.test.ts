import { describe, expect, it } from "vitest";
import { createConsentReceipt } from "../src/privacy/egressGuard";
import {
  authorizeNewConsentSigning,
  buildFixtureCustodyLedger,
  selectActiveCustodyKey,
  signCustodiedConsentReceipt,
  signHistoricalCustodiedReceipt,
  verifyCustodiedConsentReceipt,
  verifyCustodyLedger,
  type CustodyLedger
} from "../src/privacy/keyCustody";
import { buildKeyCustodyReport } from "../src/evals/keyCustodyReport";
import { scenarios } from "../src/scenarios/library";

const scenario = scenarios.find((candidate) => candidate.id === "subscription-negotiation");
if (!scenario) {
  throw new Error("subscription-negotiation scenario fixture is missing");
}
const receipt = createConsentReceipt(
  scenario,
  "negotiation-payload",
  "personal_cloud",
  "minimized_payload",
  "Submit minimized negotiation payload to the subscription provider."
);

describe("key custody lifecycle", () => {
  it("allows the active key, denies retired and revoked keys, and preserves historical verification", () => {
    const ledger = buildFixtureCustodyLedger();
    const activeKey = selectActiveCustodyKey(ledger);

    expect(activeKey?.keyId).toBe("paisl-consent-fixture-v2");
    expect(authorizeNewConsentSigning(ledger, activeKey?.keyId ?? "").allowed).toBe(true);
    expect(authorizeNewConsentSigning(ledger, "paisl-consent-fixture-v1").allowed).toBe(false);
    expect(authorizeNewConsentSigning(ledger, "paisl-consent-fixture-revoked").allowed).toBe(false);

    const activeEnvelope = signCustodiedConsentReceipt(
      ledger,
      "paisl-consent-fixture-v2",
      receipt,
      "2026-05-22T00:05:00.000Z"
    );
    const historicalEnvelope = signHistoricalCustodiedReceipt(
      ledger,
      "paisl-consent-fixture-v1",
      receipt,
      "2026-05-21T12:00:00.000Z"
    );

    expect(verifyCustodiedConsentReceipt(ledger, activeEnvelope).valid).toBe(true);
    expect(verifyCustodiedConsentReceipt(ledger, historicalEnvelope).valid).toBe(true);
  });

  it("detects custody event-chain tampering", () => {
    const ledger = buildFixtureCustodyLedger();
    const tampered = {
      keys: ledger.keys,
      events: ledger.events.map((event, index) =>
        index === 2 ? { ...event, reason: "Quietly changed retirement reason." } : event
      )
    };

    expect(verifyCustodyLedger(ledger).valid).toBe(true);
    expect(verifyCustodyLedger(tampered).valid).toBe(false);
  });

  it("detects key status tampering even when the event hash chain is unchanged", () => {
    const ledger = buildFixtureCustodyLedger();
    const tampered: CustodyLedger = {
      keys: ledger.keys.map((key) =>
        key.keyId === "paisl-consent-fixture-v1" ? { ...key, status: "active" } : key
      ),
      events: ledger.events
    };

    expect(verifyCustodyLedger(tampered).valid).toBe(false);
  });

  it("generates a report with negative controls and explicit non-production limitations", () => {
    const report = buildKeyCustodyReport(scenarios);

    expect(report.passed).toBe(report.probeCount);
    expect(report.attackProbesPassed).toBe(report.attackProbeCount);
    expect(report.threatModelVariants.map((variant) => variant.id)).toEqual([
      "user_held_key",
      "device_bound_key",
      "broker_managed_key"
    ]);
    expect(report.probes.map((probe) => probe.id)).toContain("tampered-envelope-fails-signature");
    expect(report.probes.map((probe) => probe.id)).toContain("tampered-ledger-fails-hash-chain");
    expect(report.probes.map((probe) => probe.id)).toContain(
      "tampered-key-status-fails-ledger-consistency"
    );
    expect(report.attackProbes.map((probe) => probe.attack)).toEqual(
      expect.arrayContaining([
        "replayed_receipt",
        "stale_key",
        "confused_deputy",
        "cross_scenario_receipt_reuse"
      ])
    );
    expect(report.limitations.join(" ")).toContain("not production key custody");
  });
});
