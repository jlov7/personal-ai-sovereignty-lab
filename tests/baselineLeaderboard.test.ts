import { describe, expect, it } from "vitest";
import { compareBaselines } from "../src/evals/baselines";
import { buildBaselineLeaderboardReport } from "../src/evals/baselineLeaderboardReport";
import type { BaselineSubmissionReport } from "../src/evals/baselineSubmission";
import type { SubmittedArtifactRunnerReport } from "../src/evals/submittedArtifactRunnerReport";
import { scenarios } from "../src/scenarios/library";

describe("baseline leaderboard report", () => {
  it("keeps strong-baseline claims blocked while seed adapters remain runnable", () => {
    const report = buildBaselineLeaderboardReport(
      compareBaselines(),
      seedBaselineSubmissionReport(),
      seedSubmittedArtifactRunnerReport(),
      scenarios.length
    );

    expect(report.entries.map((entry) => entry.adapterId)).toContain("centralized_cloud");
    expect(report.entries.map((entry) => entry.adapterId)).toContain("local_only");
    expect(report.entries.map((entry) => entry.adapterId)).toContain("brokered_tool_agent");
    expect(report.entries.map((entry) => entry.adapterId)).toContain("submitted_artifact_fixture");
    expect(report.blockedStrongBaselineClaim).toBe(true);
    expect(report.gates.find((gate) => gate.id === "strong-independent-baseline-required")?.status).toBe(
      "blocked_external"
    );
    expect(report.localOpenAiCompatibleWrapper.docsPath).toBe("docs/baseline_adapters.md");
  });
});

function seedBaselineSubmissionReport(): BaselineSubmissionReport {
  return {
    benchmark: "personal-ai-sovereignty-benchmark",
    version: "test",
    generatedAt: "2026-05-23T00:00:00.000Z",
    sourcePaths: ["examples/baseline_submission.example.json"],
    submissionCount: 1,
    externalSubmissionCount: 0,
    productionSubmissionCount: 0,
    systemTypeCounts: [{ systemType: "deterministic_reference", count: 1 }],
    scenarioCoverage: {
      coveredScenarioCount: 1,
      totalScenarioCount: scenarios.length,
      coveredScenarioRate: 1 / scenarios.length
    },
    submissions: [],
    readinessChecks: [],
    blockers: ["independent-external-baseline"],
    limitations: []
  };
}

function seedSubmittedArtifactRunnerReport(): SubmittedArtifactRunnerReport {
  return {
    benchmark: "personal-ai-sovereignty-benchmark",
    version: "test",
    generatedAt: "2026-05-23T00:00:00.000Z",
    runnerMode: "submitted_artifact_contract_with_broker_and_sandbox_attestations",
    sourcePaths: [],
    submissionCount: 2,
    traceEmissionCount: 2,
    signedReceiptCount: 2,
    verifiedReceiptCount: 2,
    passedSubmissionCount: 2,
    brokerExecutedActionCount: 2,
    brokerBlockedActionCount: 2,
    sandboxedExecutionPassedCount: 2,
    dockerProfile: {
      status: "passed",
      dockerAvailable: true,
      image: "node:24-alpine",
      profile: "docker_network_none_readonly_workspace_no_new_privileges",
      profileArgs: [],
      controlProbeCount: 0,
      passedControlProbeCount: 0,
      probes: [],
      limitations: []
    },
    receipts: [
      {
        receiptId: "receipt-a",
        artifactId: "artifact-a",
        runnerVersion: "0.17.0-submitted-artifact-runner",
        generatedAt: "2026-05-23T00:00:00.000Z",
        scenarioId: "subscription-negotiation",
        expectedTraceId: "trace-a",
        emittedTraceId: "trace-a",
        sourcePath: "examples/submitted_artifacts/a/agent.mjs",
        sourceSha256: "a".repeat(64),
        sourceBytes: 1,
        traceSha256: "b".repeat(64),
        brokerAttestationId: "broker-a",
        sandboxedExecutionAttestationId: "sandbox-a",
        passed: true,
        signature: {
          algorithm: "HMAC-SHA256",
          keyId: "paisl-submission-receipt-fixture-v1",
          canonicalization: "json-stable-sort-v1",
          value: "c".repeat(64)
        }
      }
    ],
    executions: [],
    limitations: []
  };
}
