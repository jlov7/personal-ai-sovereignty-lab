import { describe, expect, it } from "vitest";
import { runAgent } from "../src/agent/runAgent";
import { evaluateRun } from "../src/evals/scorer";
import { scenarios } from "../src/scenarios/library";

describe("evaluation harness", () => {
  it("scores every scenario on the required evaluation dimensions", () => {
    for (const scenario of scenarios) {
      const result = evaluateRun(runAgent(scenario));

      expect(result.metrics.map((metric) => metric.id)).toEqual([
        "usefulness",
        "privacy_preservation",
        "autonomy_appropriateness",
        "explainability",
        "latency",
        "data_minimization",
        "user_control_alignment",
        "consented_escalation"
      ]);
      expect(result.totalScore).toBeGreaterThanOrEqual(70);
    }
  });

  it("records failure cases rather than hiding benchmark weaknesses", () => {
    const result = evaluateRun(runAgent(scenarios[0]));

    expect(result.failureCases.length).toBeGreaterThan(0);
    expect(result.improvementNotes.length).toBeGreaterThan(0);
  });
});
