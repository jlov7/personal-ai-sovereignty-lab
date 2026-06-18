import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

describe("public benchmark documentation", () => {
  it("keeps the README focused on identity, positioning, and must-read docs", () => {
    const readme = read("README.md");

    const required = [
      "Personal AI Sovereignty Lab",
      // Honest positioning against prior art.
      "OpenAI Evals / lm-evaluation-harness",
      "Stanford HELM",
      "Model cards / system cards",
      "Local-first software",
      "Enterprise AI governance",
      // Must-read credibility docs and the canonical local-model evidence.
      "docs/known_limitations.md",
      "docs/claim_evidence_index.md",
      "docs/falsification_criteria.md",
      "outputs/model_transcript_eval_multimodel.md",
      "outputs/adversarial_prompt_execution_multimodel.md",
      "ARTIFACTS.md",
      "LICENSE"
    ];
    for (const phrase of required) {
      expect(readme, `README.md must mention ${phrase}`).toContain(phrase);
    }

    // The README must stay tight: the full artifact enumeration lives in
    // ARTIFACTS.md, not inline. This guards against the README regrowing into a
    // wall of file links.
    expect(readme.split("\n").length).toBeLessThan(180);
    // No self-assigned "frontier" score may reappear in the front door.
    expect(readme).not.toMatch(/\b\d{1,3}\/100\b/);
  });

  it("keeps ARTIFACTS.md a complete, non-rotting index of every schema and doc", () => {
    const artifacts = read("ARTIFACTS.md");

    const schemaFiles = readdirSync(resolve(root, "schemas")).filter((file) =>
      file.endsWith(".schema.json")
    );
    for (const file of schemaFiles) {
      expect(artifacts, `ARTIFACTS.md must index schemas/${file}`).toContain(`schemas/${file}`);
    }

    const docFiles = readdirSync(resolve(root, "docs")).filter((file) => file.endsWith(".md"));
    for (const file of docFiles) {
      expect(artifacts, `ARTIFACTS.md must index docs/${file}`).toContain(`docs/${file}`);
    }

    // Representative outputs, examples, and release-hygiene files.
    const required = [
      "outputs/sample_eval_report.md",
      "outputs/system_card.md",
      "outputs/model_transcript_eval_multimodel.md",
      "outputs/adversarial_prompt_execution_multimodel.md",
      "examples/external_agent_trace.example.json",
      "examples/artifact_bundles/fixture_index.json",
      "examples/runner_escape_corpus/package-install-attempt.json",
      "paper/personal_ai_sovereignty_benchmark.md",
      "huggingface/README.md",
      "LICENSE",
      "CITATION.cff",
      "CONTRIBUTING.md",
      "SECURITY.md",
      "CHANGELOG.md",
      "Dockerfile"
    ];
    for (const phrase of required) {
      expect(artifacts, `ARTIFACTS.md must index ${phrase}`).toContain(phrase);
    }
  });

  it("keeps the methodology explicit about limits and benchmark object", () => {
    const standard = read("docs/benchmark_standard.md");
    const limitations = read("docs/known_limitations.md");
    const memo = read("docs/technical_memo.md");

    expect(standard).toContain("The benchmark is not only a prompt and answer.");
    expect(standard).toContain("Data-Boundary Contract");
    expect(limitations).toContain("does not provide formal differential privacy guarantees");
    expect(memo).toContain("The benchmark object is not a model answer.");
  });
});
