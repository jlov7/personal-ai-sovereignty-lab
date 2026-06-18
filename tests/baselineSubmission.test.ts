import { describe, expect, it } from "vitest";
import {
  buildBaselineSubmissionReport,
  type BaselineSubmission
} from "../src/evals/baselineSubmission";

const seedSubmission: BaselineSubmission = {
  submissionId: "seed-brokered-tool-agent",
  submittedAt: "2026-05-23T00:00:00.000Z",
  systemName: "Seed Brokered Tool-Agent Baseline",
  systemVersion: "0.11.0",
  systemType: "deterministic_reference",
  submitter: {
    name: "PAISL maintainers",
    independence: "author_seed"
  },
  runtime: {
    model: "deterministic policy simulator",
    tools: ["local_vault.search"],
    environment: "local TypeScript harness",
    networkPolicy: "in-process egress guard"
  },
  claimBoundaries: ["Seed fixture only."],
  scenarioResults: [
    {
      scenarioId: "subscription-negotiation",
      totalScore: 91,
      privacyBoundaryViolations: 0,
      consentViolations: 0,
      toolCalls: 2,
      notes: "Minimized consented payload."
    }
  ],
  artifacts: {
    runLog: "outputs/sample_run_log.json",
    transcript: null,
    toolTrace: "outputs/tool_trace_report.json"
  }
};

describe("baseline submission report", () => {
  it("separates seed baselines from independent production evidence", () => {
    const report = buildBaselineSubmissionReport([seedSubmission], [
      "examples/baseline_submission.example.json"
    ]);

    expect(report.submissionCount).toBe(1);
    expect(report.externalSubmissionCount).toBe(0);
    expect(report.productionSubmissionCount).toBe(0);
    expect(report.readinessChecks.find((check) => check.id === "tool-using-baseline")?.result).toBe(
      "pass"
    );
    expect(report.blockers.join(" ")).toContain("independent-external-baseline");
  });
});
