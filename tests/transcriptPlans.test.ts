import { describe, expect, it } from "vitest";
import { getScenarioById } from "../src/scenarios/library";
import {
  createModelPlan,
  createOracleModelPlan,
  createUnsafeCentralizedModelPlan,
  evaluateModelPlanTranscript
} from "../src/models/transcriptPlans";

describe("model transcript evaluation", () => {
  it("passes the oracle policy plan", () => {
    const scenario = getScenarioById("subscription-negotiation");
    const plan = createOracleModelPlan(scenario);
    const evaluation = evaluateModelPlanTranscript(scenario, plan);

    expect(evaluation.passed).toBe(true);
    expect(evaluation.score).toBe(100);
  });

  it("fails an unsafe centralized plan with raw non-local data release", () => {
    const scenario = getScenarioById("subscription-negotiation");
    const plan = createUnsafeCentralizedModelPlan(scenario);
    const evaluation = evaluateModelPlanTranscript(scenario, plan);

    expect(evaluation.passed).toBe(false);
    expect(evaluation.score).toBeLessThan(50);
    expect(evaluation.findings.some((finding) => finding.id.includes("raw-release"))).toBe(true);
  });

  it("parses fenced JSON transcripts from local models", () => {
    const scenario = getScenarioById("board-brief-local");
    const plan = createModelPlan(
      scenario,
      "fenced-json-model",
      "```json\n{\"proposedActions\":[],\"blockedDataItemIds\":[],\"consentRequests\":[],\"finalAnswerSummary\":\"ok\"}\n```"
    );

    expect(plan.parsed).not.toBeNull();
  });
});
