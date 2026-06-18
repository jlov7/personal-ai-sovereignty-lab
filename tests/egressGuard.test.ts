import { describe, expect, it } from "vitest";
import {
  createConsentReceipt,
  evaluateEgressAttempt,
  revokeConsentReceipt
} from "../src/privacy/egressGuard";
import { buildEnforcementReport } from "../src/evals/enforcementReport";
import { getScenarioById, scenarios } from "../src/scenarios/library";

describe("egress guard and consent receipts", () => {
  it("blocks raw protected data from non-local egress", () => {
    const scenario = getScenarioById("subscription-negotiation");
    const decision = evaluateEgressAttempt(scenario, {
      scenarioId: scenario.id,
      dataItemId: "willingness-to-pay",
      targetLayer: "federated",
      releaseForm: "raw_payload",
      purpose: "Provider asks for the user's maximum willingness to pay.",
      attemptedAt: "2026-05-22T00:00:00.000Z"
    });

    expect(decision.allowed).toBe(false);
    expect(decision.controls).toContain("release-form:raw-deny");
  });

  it("allows minimized egress only with an active scoped receipt", () => {
    const scenario = getScenarioById("subscription-negotiation");
    const receipt = createConsentReceipt(
      scenario,
      "negotiation-payload",
      "federated",
      "minimized_payload",
      "Provider-facing negotiation payload."
    );

    const allowed = evaluateEgressAttempt(scenario, {
      scenarioId: scenario.id,
      dataItemId: "negotiation-payload",
      targetLayer: "federated",
      releaseForm: "minimized_payload",
      purpose: "Provider-facing negotiation payload.",
      attemptedAt: "2026-05-22T00:00:00.000Z",
      consentReceipt: receipt
    });
    const revoked = evaluateEgressAttempt(scenario, {
      scenarioId: scenario.id,
      dataItemId: "negotiation-payload",
      targetLayer: "federated",
      releaseForm: "minimized_payload",
      purpose: "Provider-facing negotiation payload.",
      attemptedAt: "2026-05-22T01:00:00.000Z",
      consentReceipt: revokeConsentReceipt(
        receipt,
        "2026-05-22T00:30:00.000Z",
        "User revoked before provider contact."
      )
    });

    expect(allowed.allowed).toBe(true);
    expect(allowed.retention.deletionRequired).toBe(true);
    expect(revoked.allowed).toBe(false);
  });

  it("passes every generated enforcement probe", () => {
    const report = buildEnforcementReport(scenarios);

    expect(report.failed).toBe(0);
    expect(report.passed).toBe(report.probeCount);
    expect(report.probeCount).toBeGreaterThan(scenarios.length * 2);
  });
});
