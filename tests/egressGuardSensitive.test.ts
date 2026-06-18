import { describe, expect, it } from "vitest";
import { evaluateEgressAttempt } from "../src/privacy/egressGuard";
import { getScenarioById } from "../src/scenarios/library";
import type { Scenario } from "../src/shared/types";

describe("egress guard sensitive-aggregate hardening", () => {
  it("does not auto-release a sensitive, non-PII safe_aggregate item without consent", () => {
    // Forge a scenario whose item is sensitive but marked non-PII + safe_aggregate
    // — the exact shape an adversarial submitter would use to slip past an
    // aggregate allow rule. The runtime guard must require consent, matching the
    // policy engine, not auto-allow.
    const base = getScenarioById("subscription-negotiation");
    const scenario: Scenario = structuredClone(base);
    const item = scenario.dataItems[0];
    item.sensitivity = "sensitive";
    item.containsPii = false;
    item.defaultBoundary = "safe_aggregate";
    item.allowedLayers = ["local", "personal_cloud"];

    const decision = evaluateEgressAttempt(scenario, {
      scenarioId: scenario.id,
      dataItemId: item.id,
      targetLayer: "personal_cloud",
      releaseForm: "aggregate",
      purpose: "attempt to auto-release a sensitive aggregate",
      attemptedAt: "2026-05-22T00:00:00.000Z"
    });

    expect(decision.allowed).toBe(false);
  });

  it("still allows a genuinely low-sensitivity non-PII aggregate", () => {
    const base = getScenarioById("subscription-negotiation");
    const scenario: Scenario = structuredClone(base);
    const item = scenario.dataItems[0];
    item.sensitivity = "public";
    item.containsPii = false;
    item.defaultBoundary = "safe_aggregate";
    item.allowedLayers = ["local", "personal_cloud", "federated"];

    const decision = evaluateEgressAttempt(scenario, {
      scenarioId: scenario.id,
      dataItemId: item.id,
      targetLayer: "personal_cloud",
      releaseForm: "aggregate",
      purpose: "non-identifying aggregate",
      attemptedAt: "2026-05-22T00:00:00.000Z"
    });

    expect(decision.allowed).toBe(true);
  });
});
