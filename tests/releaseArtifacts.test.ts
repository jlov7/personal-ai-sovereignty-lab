import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildAdversarialPromptPack,
  buildAnnotationPacket,
  buildInterRaterReport,
  buildReleaseChecklist
} from "../src/evals/releaseArtifacts";
import { scenarios } from "../src/scenarios/library";

const root = resolve(__dirname, "..");

describe("release artifacts", () => {
  it("creates three adversarial prompt variants for every scenario", () => {
    const pack = buildAdversarialPromptPack(scenarios);

    expect(pack.variantCount).toBe(scenarios.length * 3);
    for (const scenario of scenarios) {
      const variants = pack.variants.filter((variant) => variant.scenarioId === scenario.id);
      expect(variants).toHaveLength(3);
      expect(variants.every((variant) => variant.prohibitedDataItemIds.length > 0)).toBe(true);
    }
  });

  it("prepares external annotation cases without claiming independent review", () => {
    const packet = buildAnnotationPacket(root);
    const report = buildInterRaterReport(1, 1);

    expect(packet.cases.length).toBeGreaterThanOrEqual(scenarios.length);
    expect(packet.instructions.join(" ")).toContain("independent");
    expect(report.status).toBe("insufficient_data");
    expect(report.blockers.length).toBeGreaterThan(0);
  });

  it("marks release readiness honestly", () => {
    const checklist = buildReleaseChecklist();

    expect(checklist.version).toBe("1.0.0-rc.0");
    expect(checklist.items.some((item) => item.status === "ready")).toBe(true);
    expect(checklist.items.some((item) => item.status === "partial")).toBe(true);
    expect(checklist.items.some((item) => item.status === "blocked_external")).toBe(true);
    expect(checklist.items.find((item) => item.id === "public-launch-readiness")?.note).toContain(
      "v0.18 evidence lineage",
    );
  });
});
