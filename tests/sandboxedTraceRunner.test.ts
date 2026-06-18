import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  runSandboxedTrace,
  verifySandboxedExecutionAttestation,
  type SandboxedExecutionAttestation
} from "../src/broker/sandboxedTraceRunner";
import {
  buildSandboxedTraceRunnerReport
} from "../src/evals/sandboxedTraceRunnerReport";
import type { ExternalAgentTrace } from "../src/evals/externalTraceEvaluator";

const root = resolve(__dirname, "..");

function readTrace(path: string): ExternalAgentTrace {
  return JSON.parse(readFileSync(resolve(root, path), "utf8")) as ExternalAgentTrace;
}

describe("sandboxed trace runner", () => {
  it("executes broker-approved actions and denies direct escape attempts", async () => {
    const trace = readTrace("examples/external_agent_trace.example.json");
    const attestation = await runSandboxedTrace(trace);

    expect(attestation.passed).toBe(true);
    expect(attestation.brokerExecutedActionCount).toBe(2);
    expect(attestation.childExecutedActionCount).toBe(2);
    expect(attestation.skippedByBrokerCount).toBe(1);
    expect(attestation.guardDeniedEscapeCount).toBe(2);
    expect(attestation.guardAuditEvents.some((event) => event.allowed)).toBe(true);
    expect(attestation.guardAuditEvents.some((event) => !event.allowed)).toBe(true);
    expect(verifySandboxedExecutionAttestation(attestation).valid).toBe(true);
  });

  it("skips broker-blocked raw-upload claims before child execution", async () => {
    const trace = readTrace("examples/external_traces/negative_control_raw_upload.json");
    const attestation = await runSandboxedTrace(trace);

    expect(attestation.passed).toBe(true);
    expect(attestation.brokerExecutedActionCount).toBe(0);
    expect(attestation.childExecutedActionCount).toBe(0);
    expect(attestation.brokerBlockedActionCount).toBe(1);
    expect(attestation.skippedByBrokerCount).toBe(1);
    expect(attestation.actionExecutions[0].observedStatus).toBe("skipped_by_broker");
    expect(attestation.guardDeniedEscapeCount).toBe(2);
  });

  it("detects sandboxed execution attestation tampering", async () => {
    const trace = readTrace("examples/external_agent_trace.example.json");
    const attestation = await runSandboxedTrace(trace);
    const tampered: SandboxedExecutionAttestation = {
      ...attestation,
      childExecutedActionCount: attestation.childExecutedActionCount + 1
    };

    expect(verifySandboxedExecutionAttestation(attestation).valid).toBe(true);
    expect(verifySandboxedExecutionAttestation(tampered).valid).toBe(false);
  });

  it("builds the aggregate runner report for all submitted traces", async () => {
    const traces = [
      readTrace("examples/external_agent_trace.example.json"),
      readTrace("examples/external_traces/negative_control_raw_upload.json")
    ];
    const report = await buildSandboxedTraceRunnerReport(traces, [
      "examples/external_agent_trace.example.json",
      "examples/external_traces/negative_control_raw_upload.json"
    ]);

    expect(report.traceCount).toBe(2);
    expect(report.verifiedExecutionAttestationCount).toBe(2);
    expect(report.passedExecutionAttestationCount).toBe(2);
    expect(report.guardDeniedEscapeCount).toBe(4);
  });
});
