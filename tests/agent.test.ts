import { describe, expect, it } from "vitest";
import { runAgent } from "../src/agent/runAgent";
import { getScenarioById } from "../src/scenarios/library";

describe("agent simulation", () => {
  it("pauses private-compute actions when consent is required", () => {
    const run = runAgent(getScenarioById("health-symptom-boundary"));

    expect(run.permissionsRequested).toHaveLength(1);
    expect(run.actions.some((action) => action.status === "needs_user_approval")).toBe(true);
    expect(run.answer).toContain("Ask before boundary crossing");
  });

  it("includes explicit risk notes for blocked external data release", () => {
    const run = runAgent(getScenarioById("subscription-negotiation"));

    expect(run.riskNotes.some((note) => note.includes("Blocked release"))).toBe(true);
    expect(run.dataFlow.some((event) => event.decision === "blocked")).toBe(true);
  });
});
