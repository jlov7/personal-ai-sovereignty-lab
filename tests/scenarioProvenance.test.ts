import { describe, expect, it } from "vitest";
import {
  buildScenarioProvenanceReport,
  type ScenarioMutationCase
} from "../src/evals/scenarioProvenanceReport";
import { scenarios } from "../src/scenarios/library";

const families = [
  "consent_confusion",
  "authority_pressure",
  "urgency_pressure",
  "minimization_ambiguity"
];

describe("scenario provenance report", () => {
  const report = buildScenarioProvenanceReport(scenarios);

  it("assigns provenance metadata to every current scenario", () => {
    expect(report.provenance).toHaveLength(scenarios.length);
    expect(report.scenarioCount).toBe(scenarios.length);

    for (const entry of report.provenance) {
      expect(entry.author).toBe("PAISL maintainers");
      expect(entry.sourceType).toBe("synthetic_author_seed");
      expect(entry.domain).toBeTruthy();
      expect(entry.maxSensitivity).toBeTruthy();
      expect(entry.intendedFailureModes.length).toBeGreaterThan(0);
      expect(["low", "medium", "high"]).toContain(entry.ambiguityLevel);
      expect(["public_seed", "development", "public_eval"]).toContain(entry.split);
      expect(entry.provenanceNotes.join(" ")).toContain("independent provenance review");
    }
  });

  it("keeps hidden split content as commitments without public answers", () => {
    const hiddenSplit = report.splitPlan.find((split) => split.split === "hidden_commitment_only");

    expect(hiddenSplit).toBeDefined();
    expect(hiddenSplit?.publicAnswersIncluded).toBe(false);
    expect(hiddenSplit?.count).toBe(report.hiddenSplitCommitments.length);

    for (const commitment of report.hiddenSplitCommitments) {
      expect(commitment.disclosed).toBe(false);
      expect(commitment.commitment).toMatch(/^[a-f0-9]{64}$/);
      expect(commitment.note.toLowerCase()).not.toContain("answer key");
    }
  });

  it("generates all required mutation families without hidden-answer leakage", () => {
    expect(report.mutationCount).toBe(scenarios.length * families.length);

    for (const scenario of scenarios) {
      const mutations = report.mutations.filter((mutation) => mutation.scenarioId === scenario.id);
      expect(mutations.map((mutation) => mutation.family).sort()).toEqual([...families].sort());

      for (const mutation of mutations) {
        expect(mutation.protectedDataItemIds.length).toBeGreaterThan(0);
        expect(hasHiddenAnswerLeakage(mutation)).toBe(false);
      }
    }
  });
});

function hasHiddenAnswerLeakage(mutation: ScenarioMutationCase): boolean {
  const text = `${mutation.promptDelta} ${mutation.expectedSafeBehavior}`.toLowerCase();
  return text.includes("answer key") || text.includes("hidden answer");
}
