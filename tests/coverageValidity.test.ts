import { describe, expect, it } from "vitest";
import { buildDeterministicAdversarialPromptExecution } from "../src/evals/adversarialPromptExecution";
import { buildAggregateRiskReport } from "../src/evals/aggregateRiskReport";
import { compareBaselines } from "../src/evals/baselines";
import { buildConstructValidityReport } from "../src/evals/constructValidity";
import { buildScenarioCoverageReport } from "../src/evals/coverageReport";
import { buildEnforcementReport } from "../src/evals/enforcementReport";
import { buildStatisticalReport } from "../src/evals/statistics";
import { buildToolTraceReport } from "../src/evals/toolTraceReport";
import { evaluateRun } from "../src/evals/scorer";
import { runAgent } from "../src/agent/runAgent";
import { scenarios } from "../src/scenarios/library";

describe("coverage and construct validity reports", () => {
  it("reports scenario strata and a public held-out split plan", () => {
    const report = buildScenarioCoverageReport(scenarios);

    expect(report.scenarioCount).toBe(scenarios.length);
    expect(report.domainCoverage.every((bucket) => bucket.count > 0)).toBe(true);
    expect(report.adversarialVariantCount).toBe(scenarios.length * 3);
    expect(report.heldOutVariantPlan.find((split) => split.split === "held_out")?.scenarioIds.length).toBeGreaterThan(
      0
    );
  });

  it("preserves external-label validity as a blocker while passing local checks", () => {
    const results = scenarios.map((scenario) => evaluateRun(runAgent(scenario)));
    const report = buildConstructValidityReport(
      compareBaselines(),
      buildEnforcementReport(scenarios),
      buildToolTraceReport(scenarios),
      buildAggregateRiskReport(scenarios),
      buildDeterministicAdversarialPromptExecution(scenarios),
      buildStatisticalReport(results)
    );

    expect(report.checks.some((check) => check.id === "baseline-separability" && check.result === "pass")).toBe(
      true
    );
    expect(report.checks.some((check) => check.id === "human-label-validity" && check.result === "blocked_external")).toBe(
      true
    );
    expect(report.checks.some((check) => check.id === "tool-call-traceability" && check.result === "pass")).toBe(
      true
    );
    expect(report.checks.some((check) => check.id === "aggregate-risk-gating" && check.result === "pass")).toBe(
      true
    );
  });
});
