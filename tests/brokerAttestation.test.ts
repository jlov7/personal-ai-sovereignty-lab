import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  brokerExternalTrace,
  verifyBrokerAttestation,
  type BrokeredTraceAttestation
} from "../src/broker/traceBroker";
import {
  buildBrokerAttestationReport
} from "../src/evals/brokerAttestationReport";
import type { ExternalAgentTrace } from "../src/evals/externalTraceEvaluator";

const root = resolve(__dirname, "..");

function readTrace(path: string): ExternalAgentTrace {
  return JSON.parse(readFileSync(resolve(root, path), "utf8")) as ExternalAgentTrace;
}

describe("brokered trace attestations", () => {
  it("signs and verifies a safe seed trace while preserving submitted blocks", () => {
    const trace = readTrace("examples/external_agent_trace.example.json");
    const attestation = brokerExternalTrace(trace);

    expect(verifyBrokerAttestation(attestation).valid).toBe(true);
    expect(attestation.executedActionCount).toBe(2);
    expect(attestation.submittedBlockedConfirmedCount).toBe(1);
    expect(attestation.claimedCompletedButBlockedCount).toBe(0);
  });

  it("blocks unsafe completed raw-upload claims and detects attestation tampering", () => {
    const trace = readTrace("examples/external_traces/negative_control_raw_upload.json");
    const attestation = brokerExternalTrace(trace);
    const tampered: BrokeredTraceAttestation = {
      ...attestation,
      executedActionCount: attestation.executedActionCount + 1
    };

    expect(attestation.executedActionCount).toBe(0);
    expect(attestation.claimedCompletedButBlockedCount).toBe(1);
    expect(attestation.actionResults[0].brokerDecision).toBe("blocked");
    expect(verifyBrokerAttestation(attestation).valid).toBe(true);
    expect(verifyBrokerAttestation(tampered).valid).toBe(false);
  });

  it("distinguishes confirmed unsafe blocks from over-conservative submitted blocks", () => {
    const seed = readTrace("examples/external_agent_trace.example.json");
    const trace: ExternalAgentTrace = {
      ...seed,
      traceId: "overconservative-local-block",
      actions: [{ ...seed.actions[0], status: "blocked" }]
    };
    const attestation = brokerExternalTrace(trace);

    expect(attestation.submittedBlockedConfirmedCount).toBe(0);
    expect(attestation.actionResults[0].findings[0].id).toBe("submitted-block-overconservative");
    expect(verifyBrokerAttestation(attestation).valid).toBe(true);
  });

  it("builds a report that links broker attestations to external trace scores", () => {
    const traces = [
      readTrace("examples/external_agent_trace.example.json"),
      readTrace("examples/external_traces/negative_control_raw_upload.json")
    ];
    const report = buildBrokerAttestationReport(traces, [
      "examples/external_agent_trace.example.json",
      "examples/external_traces/negative_control_raw_upload.json"
    ]);

    expect(report.traceCount).toBe(2);
    expect(report.verifiedAttestationCount).toBe(2);
    expect(report.claimedCompletedButBlockedCount).toBe(1);
    expect(report.evaluationLinks.some((link) => link.externalTraceScore < 100)).toBe(true);
  });
});
