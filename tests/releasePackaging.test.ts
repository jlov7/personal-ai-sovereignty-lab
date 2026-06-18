import { describe, expect, it } from "vitest";
import { renderHuggingFaceJsonl } from "../src/evals/hfDataset";
import { buildRuntimeManifest } from "../src/evals/runtimeManifest";
import { publicScenarios, scenarios } from "../src/scenarios/library";

describe("public release packaging", () => {
  it("builds a runtime manifest with explicit non-claims", () => {
    const manifest = buildRuntimeManifest(scenarios);

    expect(manifest.scenarioCoverage.scenarioCount).toBe(scenarios.length);
    expect(manifest.reproducibilityCommands).toContain("pnpm eval");
    expect(manifest.nonClaims.join(" ")).toContain("external benchmark validation");
  });

  it("exports every scenario as JSONL for a Hugging Face-ready dataset preview", () => {
    const jsonl = renderHuggingFaceJsonl(publicScenarios);
    const rows = jsonl.trim().split("\n").map((line) => JSON.parse(line) as { id: string });

    expect(rows).toHaveLength(publicScenarios.length);
    expect(new Set(rows.map((row) => row.id)).size).toBe(publicScenarios.length);
  });
});
