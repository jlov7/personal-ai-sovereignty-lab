import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isNearDuplicate,
  maxTokenSimilarity,
  normalizedTokens,
  scenarioText,
  scenarioTokenEntry
} from "../src/generator/dedup";
import { mulberry32 } from "../src/generator/prng";
import { generateScenarios, renderScenarioModule } from "../src/generator/scenarioGenerator";
import {
  curatedScenarios,
  generatedScenarios,
  publicScenarios
} from "../src/scenarios/library";

describe("scenario generator", () => {
  it("locks the mulberry32 stream with known answers", () => {
    const random = mulberry32(1);

    expect(Array.from({ length: 5 }, () => Number(random().toFixed(10)))).toEqual([
      0.6270739406,
      0.0027357212,
      0.52744704,
      0.9810509675,
      0.9683778982
    ]);
  });

  it("emits byte-identical scenario modules for the same seed and count", () => {
    const first = generateScenarios({ seed: 777, count: 8, existingScenarios: curatedScenarios });
    const second = generateScenarios({ seed: 777, count: 8, existingScenarios: curatedScenarios });

    expect(renderScenarioModule(first)).toBe(renderScenarioModule(second));
  });

  it("rejects normalized-text near duplicates against the curated library", () => {
    const duplicate = {
      ...curatedScenarios[0],
      id: "generated-copy"
    };

    expect(isNearDuplicate(duplicate, curatedScenarios, 0.85)).toBe(true);
  });

  it("commits a 451-scenario public corpus with unique ids and duplicate controls", () => {
    expect(curatedScenarios).toHaveLength(51);
    expect(generatedScenarios).toHaveLength(400);
    expect(publicScenarios.length).toBeGreaterThanOrEqual(451);
    expect(new Set(publicScenarios.map((scenario) => scenario.id)).size).toBe(publicScenarios.length);

    const tokenEntries = publicScenarios.map(scenarioTokenEntry);
    for (const scenario of generatedScenarios) {
      const comparisonSet = tokenEntries.filter((entry) => entry.scenarioId !== scenario.id);
      expect(maxTokenSimilarity(normalizedTokens(scenarioText(scenario)), comparisonSet)).toBeLessThanOrEqual(0.85);
    }
  });

  it("loads the public corpus in the demo scenario list", () => {
    const source = readFileSync(resolve(__dirname, "../src/ui/App.tsx"), "utf8");

    expect(source).toContain("publicScenarios.map");
    expect(source).not.toContain("scenarios.map");
  });
});
