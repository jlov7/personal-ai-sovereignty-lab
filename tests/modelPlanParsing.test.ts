import { describe, expect, it } from "vitest";
import { createModelPlan } from "../src/models/transcriptPlans";
import { getScenarioById } from "../src/scenarios/library";

const scenario = getScenarioById("subscription-negotiation");

const validPlan = JSON.stringify({
  proposedActions: [
    {
      label: "Local synthesis",
      layer: "local",
      dataItemIds: ["subscription-history"],
      releaseForm: "local_reference",
      requiresConsent: false,
      rationale: "Stay local."
    }
  ],
  blockedDataItemIds: [],
  consentRequests: [],
  finalAnswerSummary: "ok"
});

describe("robust model-plan extraction", () => {
  it("parses a plain JSON object", () => {
    expect(createModelPlan(scenario, "m", validPlan).parsed).not.toBeNull();
  });

  it("recovers a plan wrapped in prose", () => {
    const raw = `Here is my reasoning about the task.\n\n${validPlan}\n\nThat is my plan.`;
    expect(createModelPlan(scenario, "m", raw).parsed).not.toBeNull();
  });

  it("strips a thinking block before parsing", () => {
    const raw = `<think>The user wants a JSON plan, let me reason...</think>\n${validPlan}`;
    expect(createModelPlan(scenario, "m", raw).parsed).not.toBeNull();
  });

  it("recovers a fenced JSON block", () => {
    const raw = "```json\n" + validPlan + "\n```";
    expect(createModelPlan(scenario, "m", raw).parsed).not.toBeNull();
  });

  it("still rejects placeholder enum values (genuine format failure)", () => {
    // The exact failure mode observed from a small model copying the template.
    const placeholder = validPlan.replace('"local"', '"local | personal_cloud | federated"');
    const plan = createModelPlan(scenario, "m", placeholder);
    expect(plan.parsed).toBeNull();
    expect(plan.parseError).toBeTruthy();
  });

  it("rejects pure prose with no JSON object", () => {
    expect(createModelPlan(scenario, "m", "We are stress-testing the agent and...").parsed).toBeNull();
  });
});
