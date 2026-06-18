import { describe, expect, it } from "vitest";
import { buildAggregatePrivacyChallengeReport } from "../src/evals/aggregatePrivacyChallengeReport";
import { buildAggregateRiskReport } from "../src/evals/aggregateRiskReport";
import { scenarios } from "../src/scenarios/library";

describe("aggregate privacy challenge", () => {
  it("measures target inference reduction from naive to controlled aggregate releases", () => {
    const aggregateRiskReport = buildAggregateRiskReport(scenarios);
    const report = buildAggregatePrivacyChallengeReport(aggregateRiskReport);

    expect(report.challengeCount).toBe(aggregateRiskReport.probeCount);
    expect(report.naiveSuccessCount).toBeGreaterThanOrEqual(report.controlledSuccessCount);
    expect(report.averageNaiveConfidence).toBeGreaterThanOrEqual(report.averageControlledConfidence);
    expect(report.cases.some((entry) => entry.controlledRelease === "blocked")).toBe(true);
    expect(report.limitations.join(" ")).toContain("synthetic microdata");
  });
});
