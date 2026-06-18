import { describe, expect, it } from "vitest";
import { buildAggregateEmpiricalAttackReport } from "../src/evals/aggregateEmpiricalAttackReport";
import { buildAggregateRiskReport } from "../src/evals/aggregateRiskReport";
import { scenarios } from "../src/scenarios/library";

describe("aggregate empirical attack report", () => {
  it("simulates cohort uniqueness pressure for every aggregate-risk probe", () => {
    const riskReport = buildAggregateRiskReport(scenarios);
    const report = buildAggregateEmpiricalAttackReport(riskReport);

    expect(report.attackCount).toBe(riskReport.probeCount);
    expect(report.averageUniqueSignatureRate).toBeGreaterThan(0);
    expect(report.simulatedSuccessCount).toBeGreaterThan(0);
    expect(report.mitigatedByExistingGateCount + report.needsEmpiricalMitigationCount).toBeGreaterThan(0);
    expect(report.limitations.join(" ")).toContain("not an attack against real user data");
  });
});
