import { describe, expect, it } from "vitest";
import { runAgent } from "../src/agent/runAgent";
import { buildStatisticalReport, bootstrapMeanInterval } from "../src/evals/statistics";
import { evaluateRun } from "../src/evals/scorer";
import { scenarios } from "../src/scenarios/library";

describe("statistical reporting", () => {
  it("builds a deterministic confidence interval over scenario scores", () => {
    const interval = bootstrapMeanInterval([70, 80, 90, 100], {
      resamples: 200,
      confidence: 0.9,
      seed: 123
    });

    expect(interval.lower).toBeLessThanOrEqual(interval.mean);
    expect(interval.upper).toBeGreaterThanOrEqual(interval.mean);
    expect(interval).toEqual(
      bootstrapMeanInterval([70, 80, 90, 100], {
        resamples: 200,
        confidence: 0.9,
        seed: 123
      })
    );
  });

  it("reports score distributions and weight sensitivity for the full scenario suite", () => {
    const results = scenarios.map((scenario) => evaluateRun(runAgent(scenario)));
    const report = buildStatisticalReport(results);

    expect(report.scenarioCount).toBe(scenarios.length);
    expect(report.bootstrapMeanInterval.resamples).toBe(1000);
    expect(report.metricDistributions).toHaveLength(results[0].metrics.length);
    expect(report.sensitivityRows.map((row) => row.id)).toContain("privacy_x2");
    expect(report.detectableEffectEstimates.length).toBeGreaterThan(0);
    expect(report.detectableEffectEstimates.some((row) => row.currentScenarioCountSufficient)).toBe(
      true
    );
    expect(report.maxSensitivitySwing).toBeGreaterThanOrEqual(0);
    expect(report.limitations.join(" ")).toContain("synthetic");
  });

  it("keeps the equal-weight base sensitivity row equal to the headline mean", () => {
    const results = scenarios.map((scenario) => evaluateRun(runAgent(scenario)));
    const report = buildStatisticalReport(results);
    const baseRow = report.sensitivityRows.find((row) => row.id === "base");

    expect(baseRow).toBeDefined();
    // Both are "the published equal-weight scorecard"; they must not disagree.
    expect(baseRow?.averageScore).toBe(report.scoreDistribution.mean);
    expect(baseRow?.deltaFromBase).toBe(0);
  });
});
