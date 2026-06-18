import { describe, expect, it } from "vitest";
import { buildAggregateRiskReport } from "../src/evals/aggregateRiskReport";
import { buildExecutableAggregateAttackReport } from "../src/evals/executableAggregateAttackReport";
import { scenarios } from "../src/scenarios/library";

describe("executable aggregate attack report", () => {
  it("executes differencing and linkage attacks against every aggregate-risk probe", () => {
    const riskReport = buildAggregateRiskReport(scenarios);
    const report = buildExecutableAggregateAttackReport(riskReport);

    expect(report.attackCount).toBe(riskReport.probeCount * 3);
    expect(report.naiveSuccessCount).toBeGreaterThan(riskReport.probeCount);
    expect(report.blockedByExistingGateCount).toBeGreaterThan(0);
    expect(report.needsReleaseControlCount).toBeGreaterThan(0);
    expect(report.attacks.some((attack) => attack.attackFamily === "exact-differencing")).toBe(true);
    expect(report.limitations.join(" ")).toContain("does not provide formal differential privacy");
  });
});
