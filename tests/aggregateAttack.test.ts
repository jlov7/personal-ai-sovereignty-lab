import { describe, expect, it } from "vitest";
import { buildAggregateAttackReport } from "../src/evals/aggregateAttackReport";
import { buildAggregateRiskReport } from "../src/evals/aggregateRiskReport";
import { scenarios } from "../src/scenarios/library";

describe("aggregate attack report", () => {
  it("turns aggregate-risk probes into explicit synthetic attack cases", () => {
    const riskReport = buildAggregateRiskReport(scenarios);
    const attackReport = buildAggregateAttackReport(riskReport);

    expect(attackReport.attackCount).toBe(riskReport.probeCount * 6);
    expect(attackReport.highestEstimatedSuccessProbability).toBeGreaterThan(0);
    expect(attackReport.blockedByExistingGate + attackReport.requiresNewControl).toBeGreaterThan(0);
    expect(new Set(attackReport.attacks.map((attack) => attack.attackFamily))).toEqual(
      new Set([
        "membership-inference",
        "attribute-inference",
        "repeated-release-differencing",
        "rare-cohort-join",
        "threshold-attack",
        "noisy-release-sensitivity"
      ])
    );
    expect(attackReport.attackCards.length).toBeGreaterThan(0);
    expect(attackReport.privacyAccounting.formalEpsilonProvided).toBe(false);
    expect(attackReport.attacks.every((attack) => attack.attackPreconditions.length > 0)).toBe(true);
    expect(attackReport.attacks.every((attack) => attack.syntheticTransferLimits.length > 0)).toBe(true);
    expect(attackReport.limitations.join(" ")).toContain("not empirical privacy research");
  });
});
