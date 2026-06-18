import { describe, expect, it } from "vitest";
import { runAgent } from "../src/agent/runAgent";
import { buildMeasurementValidityReport } from "../src/evals/measurementValidityReport";
import { evaluateRun } from "../src/evals/scorer";
import { scenarios } from "../src/scenarios/library";

describe("measurement validity report", () => {
  it("maps every score metric to observable reviewer evidence", () => {
    const results = scenarios.map((scenario) => evaluateRun(runAgent(scenario)));
    const report = buildMeasurementValidityReport(results, scenarios);
    const metricIds = new Set(report.labelCalibrationPacket.metrics.map((metric) => metric.metricId));

    expect(metricIds).toEqual(
      new Set([
        "usefulness",
        "privacy_preservation",
        "autonomy_appropriateness",
        "explainability",
        "latency",
        "data_minimization",
        "user_control_alignment",
        "consented_escalation"
      ])
    );
    expect(
      report.labelCalibrationPacket.metrics.every(
        (metric) =>
          metric.observableEvidence.length > 0 &&
          metric.failureSignals.length > 0 &&
          metric.scoreAnchors.length >= 3
      )
    ).toBe(true);
  });

  it("keeps synthetic agreement checks explicitly outside validation claims", () => {
    const results = scenarios.map((scenario) => evaluateRun(runAgent(scenario)));
    const report = buildMeasurementValidityReport(results, scenarios);

    expect(report.syntheticAgreementChecks).toHaveLength(2);
    expect(report.syntheticAgreementChecks.every((check) => check.passed)).toBe(true);
    expect(report.syntheticAgreementChecks.every((check) => check.countsAsValidation === false)).toBe(true);
    expect(report.blockers.join(" ")).toContain("Independent reviewers");
  });

  it("reports metric-weight ablations and scenario difficulty coverage", () => {
    const results = scenarios.map((scenario) => evaluateRun(runAgent(scenario)));
    const report = buildMeasurementValidityReport(results, scenarios);

    expect(report.metricAblations.profiles.length).toBeGreaterThanOrEqual(5);
    expect(report.metricAblations.results).toHaveLength(report.metricAblations.profiles.length);
    expect(report.metricAblations.largestScenarioShifts.length).toBeGreaterThan(0);
    expect(report.scenarioDifficulty.tags).toHaveLength(scenarios.length);
    expect(
      report.scenarioDifficulty.difficultyCoverage.reduce((sum, bucket) => sum + bucket.count, 0)
    ).toBe(scenarios.length);
    expect(
      report.scenarioDifficulty.ambiguityCoverage.reduce((sum, bucket) => sum + bucket.count, 0)
    ).toBe(scenarios.length);
  });
});
