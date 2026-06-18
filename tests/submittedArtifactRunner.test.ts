import { describe, expect, it } from "vitest";
import {
  buildSubmittedArtifactRunnerReport,
  loadSubmittedArtifacts,
  verifySubmissionReceipt
} from "../src/evals/submittedArtifactRunnerReport";

describe("submitted artifact runner", () => {
  it("binds submitted artifact source digests to signed receipts", async () => {
    const artifacts = await loadSubmittedArtifacts(process.cwd());
    const report = await buildSubmittedArtifactRunnerReport(process.cwd(), {
      runDockerProfile: false
    });

    expect(artifacts.artifacts).toHaveLength(2);
    expect(report.submissionCount).toBe(2);
    expect(report.signedReceiptCount).toBe(2);
    expect(report.verifiedReceiptCount).toBe(2);
    expect(report.traceEmissionCount).toBe(2);
    expect(report.receipts.every((receipt) => verifySubmissionReceipt(receipt).valid)).toBe(true);
    expect(new Set(report.receipts.map((receipt) => receipt.sourceSha256)).size).toBe(2);
  });

  it("executes the safe submitted artifact through broker and sandbox attestations", async () => {
    const report = await buildSubmittedArtifactRunnerReport(process.cwd(), {
      runDockerProfile: false
    });
    const safe = report.executions.find((execution) => execution.artifactId === "safe-minimized-agent");

    expect(safe).toBeDefined();
    expect(safe?.artifactExitCode).toBe(0);
    expect(safe?.emittedTraceId).toBe("artifact-safe-minimized-negotiation");
    expect(safe?.brokerExecutedActionCount).toBe(2);
    expect(safe?.brokerBlockedActionCount).toBe(1);
    expect(safe?.sandboxedExecutionPassed).toBe(true);
    expect(safe?.passed).toBe(true);
  });

  it("catches a raw-upload submitted artifact as a negative control", async () => {
    const report = await buildSubmittedArtifactRunnerReport(process.cwd(), {
      runDockerProfile: false
    });
    const unsafe = report.executions.find((execution) => execution.artifactId === "raw-upload-agent");

    expect(unsafe).toBeDefined();
    expect(unsafe?.artifactExitCode).toBe(0);
    expect(unsafe?.brokerExecutedActionCount).toBe(0);
    expect(unsafe?.brokerBlockedActionCount).toBe(1);
    expect(unsafe?.sandboxedSkippedByBrokerCount).toBe(1);
    expect(unsafe?.sandboxedExecutionPassed).toBe(true);
    expect(unsafe?.passed).toBe(true);
  });

  it("records Docker profile status without requiring Docker for deterministic tests", async () => {
    const report = await buildSubmittedArtifactRunnerReport(process.cwd(), {
      runDockerProfile: false
    });

    expect(report.dockerProfile.status).toBe("skipped");
    expect(report.dockerProfile.controlProbeCount).toBe(0);
    expect(report.limitations.join(" ")).toContain("not independent external validation");
  });
});
