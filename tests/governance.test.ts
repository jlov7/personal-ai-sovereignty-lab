import { describe, expect, it } from "vitest";
import { evaluateScenarioGovernance } from "../src/governance/policyEngine";
import { getScenarioById } from "../src/scenarios/library";

describe("governance policy engine", () => {
  it("keeps raw regulated financial records on the local layer", () => {
    const scenario = getScenarioById("finance-cashflow");
    const decisions = evaluateScenarioGovernance(scenario);

    const transactions = decisions.find((decision) => decision.dataItemId === "bank-transactions");

    expect(transactions?.decision).toBe("local_only");
    expect(transactions?.layer).toBe("local");
    expect(transactions?.releasedForm).toBe("local memory reference only");
  });

  it("blocks confidential personal context from external negotiation", () => {
    const scenario = getScenarioById("subscription-negotiation");
    const decisions = evaluateScenarioGovernance(scenario);

    const maxPrice = decisions.find((decision) => decision.dataItemId === "willingness-to-pay");

    expect(maxPrice?.decision).toBe("blocked");
    expect(maxPrice?.policyTags).toContain("external-release:block");
  });

  it("turns consent-gated data into minimized payload only after approval", () => {
    const scenario = getScenarioById("subscription-negotiation");
    const before = evaluateScenarioGovernance(scenario);
    const after = evaluateScenarioGovernance(scenario, {
      "negotiation-payload": true,
      "subscription-history": true
    });

    expect(before.find((decision) => decision.dataItemId === "negotiation-payload")?.decision).toBe(
      "requires_consent"
    );
    expect(after.find((decision) => decision.dataItemId === "negotiation-payload")?.decision).toBe(
      "safe_aggregate"
    );
    expect(after.find((decision) => decision.dataItemId === "negotiation-payload")?.releasedForm).toBe(
      "user-approved minimized payload"
    );
  });
});
