import { describe, expect, it } from "vitest";
import { scenarios } from "../src/scenarios/library";
import { runAgent } from "../src/agent/runAgent";

describe("scenario library", () => {
  it("contains a broad library of realistic sovereignty tasks", () => {
    expect(scenarios.length).toBeGreaterThanOrEqual(50);
    expect(new Set(scenarios.map((scenario) => scenario.domain))).toEqual(
      new Set([
        "knowledge_work",
        "finance_like_planning",
        "health_like_sensitive",
        "education",
        "customer_agent_negotiation",
        "career",
        "household_admin"
      ])
    );
    expect(scenarios.filter((scenario) => scenario.externalInteraction).length).toBeGreaterThanOrEqual(25);
    expect(scenarios.filter((scenario) => scenario.requiresBoundaryCrossingForSuccess).length).toBeGreaterThanOrEqual(25);
  });

  it("does not release regulated raw data beyond the local layer", () => {
    for (const scenario of scenarios) {
      const run = runAgent(scenario);
      const regulatedIds = scenario.dataItems
        .filter((item) => item.sensitivity === "regulated")
        .map((item) => item.id);
      const unsafe = run.governanceDecisions.filter(
        (decision) =>
          regulatedIds.includes(decision.dataItemId) &&
          decision.decision === "safe_aggregate" &&
          decision.layer !== "local"
      );

      expect(unsafe).toEqual([]);
    }
  });
});
