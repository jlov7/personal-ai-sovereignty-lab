import { describe, expect, it } from "vitest";
import { runToolAgentScenario } from "../src/agent/toolAgent";
import { buildAggregateRiskReport } from "../src/evals/aggregateRiskReport";
import { buildToolTraceReport } from "../src/evals/toolTraceReport";
import { getScenarioById, scenarios } from "../src/scenarios/library";
import type { Scenario } from "../src/shared/types";

describe("tool traces and aggregate risk", () => {
  it("records executable tool traces without allowing unsafe raw egress", () => {
    const report = buildToolTraceReport(scenarios);

    expect(report.scenarioCount).toBe(scenarios.length);
    expect(report.toolCallCount).toBeGreaterThan(scenarios.length);
    expect(report.policyViolationCount).toBe(0);
    expect(report.unsafeRawAttemptsBlocked).toBe(scenarios.length);
    expect(
      report.traces.every((trace) =>
        trace.calls.some((call) => call.expected === "must_block" && call.status === "blocked")
      )
    ).toBe(true);
  });

  it("does not schedule auto-aggregate tool execution for sensitive non-PII items", () => {
    const scenario: Scenario = structuredClone(getScenarioById("subscription-negotiation"));
    const item = scenario.dataItems[0];
    item.sensitivity = "sensitive";
    item.containsPii = false;
    item.defaultBoundary = "safe_aggregate";
    item.allowedLayers = ["local", "personal_cloud"];

    const trace = runToolAgentScenario(scenario);

    expect(trace.calls.some((call) => call.releaseForm === "aggregate" && call.expected === "must_execute")).toBe(
      false
    );
    expect(trace.policyViolationCount).toBe(0);
  });

  it("flags aggregate candidates that need stronger privacy controls", () => {
    const report = buildAggregateRiskReport(scenarios);

    expect(report.probeCount).toBeGreaterThan(0);
    expect(report.requireControlCount).toBeGreaterThan(0);
    expect(report.blockCount).toBeGreaterThan(0);
    expect(
      report.probes.every((probe) =>
        probe.recommendedDecision === "allow_aggregate"
          ? !probe.controls.includes("block-release")
          : probe.controls.includes("run-linkage-attack-test")
      )
    ).toBe(true);
  });
});
