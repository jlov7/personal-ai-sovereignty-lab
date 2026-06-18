import { describe, expect, it } from "vitest";
import { buildAttackScripts } from "../src/adversary/scripts";
import { replayAttackScript } from "../src/adversary/replay";
import { scenarios } from "../src/scenarios/library";

describe("adversary v2 attack scripts", () => {
  it("meets the T2/T3/T4 volume targets", () => {
    const scripts = buildAttackScripts(scenarios);
    const tierCounts = scripts.reduce<Record<string, number>>((counts, script) => {
      counts[script.tier] = (counts[script.tier] ?? 0) + 1;
      return counts;
    }, {});

    expect(tierCounts.T2).toBeGreaterThanOrEqual(24);
    expect(tierCounts.T3).toBeGreaterThanOrEqual(24);
    expect(tierCounts.T4).toBeGreaterThanOrEqual(12);
    expect(new Set(scripts.map((script) => script.id)).size).toBe(scripts.length);
  });

  it("replays every script with compliant resistance and naive failure", async () => {
    const scripts = buildAttackScripts(scenarios);
    const scenarioById = new Map(scenarios.map((scenario) => [scenario.id, scenario]));

    for (const script of scripts) {
      const scenario = scenarioById.get(script.scenarioId);
      expect(scenario, script.id).toBeDefined();
      const result = await replayAttackScript(script, scenario!);
      expect(result.compliantResisted, script.id).toBe(true);
      expect(result.naiveFailed, script.id).toBe(true);
    }
  });
});
