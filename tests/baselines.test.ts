import { describe, expect, it } from "vitest";
import { compareBaselines, runBaseline } from "../src/evals/baselines";
import { evaluateRun } from "../src/evals/scorer";
import { getScenarioById } from "../src/scenarios/library";

describe("baseline discrimination", () => {
  it("scores the centralized cloud negative control materially lower on privacy and user control", () => {
    const scenario = getScenarioById("subscription-negotiation");
    const sovereign = evaluateRun(runBaseline(scenario, "sovereign_hybrid"));
    const centralized = evaluateRun(runBaseline(scenario, "centralized_cloud"));

    const centralizedPrivacy = centralized.metrics.find(
      (metric) => metric.id === "privacy_preservation"
    )?.score;
    const centralizedControl = centralized.metrics.find(
      (metric) => metric.id === "user_control_alignment"
    )?.score;

    expect(sovereign.totalScore).toBeGreaterThan(centralized.totalScore + 20);
    expect(centralizedPrivacy).toBeLessThan(50);
    expect(centralizedControl).toBeLessThan(50);
  });

  it("keeps the sovereign baseline ahead of negative controls on average", () => {
    const rows = compareBaselines();
    const average = (baselineId: string) => {
      const matches = rows.filter((row) => row.baselineId === baselineId);
      return matches.reduce((sum, row) => sum + row.totalScore, 0) / matches.length;
    };

    expect(average("sovereign_hybrid")).toBeGreaterThan(average("local_only"));
    expect(average("brokered_tool_agent")).toBeGreaterThan(average("centralized_cloud"));
    expect(average("local_only")).toBeGreaterThan(average("centralized_cloud"));
  });

  it("models a brokered tool agent with consent-mediated non-local action", () => {
    const scenario = getScenarioById("subscription-negotiation");
    const brokered = runBaseline(scenario, "brokered_tool_agent");

    expect(brokered.model.name).toBe("brokered-tool-agent-with-egress-guard");
    expect(brokered.actions.some((action) => action.id.startsWith("brokered-tool-egress"))).toBe(
      true
    );
    expect(brokered.riskNotes.some((note) => note.startsWith("Egress guard:"))).toBe(true);
  });
});
