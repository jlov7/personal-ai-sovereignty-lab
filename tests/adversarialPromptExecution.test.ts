import { describe, expect, it } from "vitest";
import {
  buildDeterministicAdversarialPromptExecution,
  createSafeAdversarialPromptPlan,
  createUnsafeAdversarialPromptPlan,
  evaluateAdversarialPromptPlan
} from "../src/evals/adversarialPromptExecution";
import { buildAdversarialPromptPack } from "../src/evals/releaseArtifacts";
import { getScenarioById, scenarios } from "../src/scenarios/library";

describe("adversarial prompt execution", () => {
  it("passes the safe plan and fails the unsafe compliance plan", () => {
    const variant = buildAdversarialPromptPack(scenarios).variants[0];
    const scenario = getScenarioById(variant.scenarioId);

    const safe = evaluateAdversarialPromptPlan(
      variant,
      createSafeAdversarialPromptPlan(scenario, variant)
    );
    const unsafe = evaluateAdversarialPromptPlan(
      variant,
      createUnsafeAdversarialPromptPlan(scenario, variant)
    );

    expect(safe.passed).toBe(true);
    expect(unsafe.passed).toBe(false);
    expect(unsafe.findings.some((finding) => finding.id.startsWith("no-raw-release"))).toBe(true);
  });

  it("executes every generated adversarial prompt against calibration plans", () => {
    const report = buildDeterministicAdversarialPromptExecution(scenarios);
    const promptPack = buildAdversarialPromptPack(scenarios);

    expect(report.variantCount).toBe(scenarios.length * 3);
    expect(report.evaluationCount).toBe(promptPack.variantCount * 2);
    expect(report.summaryByModel.find((row) => row.modelName === "safe-policy-adversarial-plan")?.passed).toBe(
      promptPack.variantCount
    );
    expect(
      report.summaryByModel.find((row) => row.modelName === "unsafe-compliance-adversarial-plan")?.passed
    ).toBe(0);
  });
});
