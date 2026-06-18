import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

describe("paper package", () => {
  it("generates the paper-style release artifacts", () => {
    const files = [
      "paper/personal_ai_sovereignty_benchmark.md",
      "outputs/benchmark_release_card.md",
      "outputs/system_card.md",
      "outputs/figures_and_tables.md",
      "docs/citation_and_reproducibility_checklist.md",
    ];

    for (const file of files) {
      expect(existsSync(resolve(root, file))).toBe(true);
    }
  });

  it("keeps the paper draft structured like a research artifact", () => {
    const paper = read("paper/personal_ai_sovereignty_benchmark.md");

    for (const phrase of [
      "## Abstract",
      "## 2. Related Work And Positioning",
      "## 3. Benchmark Object",
      "## 8. Threat Model",
      "## 9. Limitations",
      "## 10. Research Roadmap",
      "not an externally validated standard",
    ]) {
      expect(paper).toContain(phrase);
    }
  });

  it("keeps cards and figures tied to benchmark evidence", () => {
    const releaseCard = read("outputs/benchmark_release_card.md");
    const systemCard = read("outputs/system_card.md");
    const figures = read("outputs/figures_and_tables.md");
    const checklist = read("docs/citation_and_reproducibility_checklist.md");

    // The release card must NOT publish a self-assigned "frontier" score.
    expect(releaseCard).not.toContain("Strict score");
    expect(releaseCard).not.toMatch(/\b\d{1,3}\/100\b/);
    expect(releaseCard).toContain("Personal AI Sovereignty Lab (PAISL)");
    expect(releaseCard).toContain("Aggregate attack cases | 354");
    expect(systemCard).toContain("Fixture keys do not provide production custody");
    expect(figures).toContain("```mermaid");
    expect(figures).toContain("## Table 5: External Blockers");
    expect(checklist).toContain("pnpm verify");
    expect(checklist).toContain("Passing local tests does not prove independent validation");
  });
});
