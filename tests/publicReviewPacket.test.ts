import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

describe("public review packet", () => {
  it("has intake forms for external critique and evidence submission", () => {
    const templates = [
      ".github/ISSUE_TEMPLATE/artifact_baseline_submission.yml",
      ".github/ISSUE_TEMPLATE/annotation_submission.yml",
      ".github/ISSUE_TEMPLATE/scenario_criticism.yml",
      ".github/ISSUE_TEMPLATE/aggregate_attack_report.yml",
      ".github/ISSUE_TEMPLATE/runner_escape_report.yml",
      ".github/ISSUE_TEMPLATE/scorecard_dispute.yml",
    ];

    for (const template of templates) {
      const body = read(template);
      expect(body).toContain("name:");
      expect(body).toContain("validations:");
      expect(body).toMatch(/Do not include|removed secrets|private data|credentials/);
    }
  });

  it("maps public claims to evidence and falsification conditions", () => {
    const index = read("docs/claim_evidence_index.md");
    const falsification = read("docs/falsification_criteria.md");

    for (const phrase of [
      "outputs/public_validation_report.md",
      "outputs/frontier_audit.md",
      "pnpm verify",
      "Not differential privacy",
      "Not production sandboxing",
      "independent validation",
      "Hugging Face",
    ]) {
      expect(index).toContain(phrase);
    }

    for (const phrase of [
      "What Would Falsify This Benchmark",
      "Inter-rater agreement",
      "strong production-grade",
      "formal differential privacy",
      "claim retraction",
      "blocked validation gate",
    ]) {
      expect(falsification).toContain(phrase);
    }
  });

  it("keeps public validation JSON aligned with the Markdown launch state", () => {
    const markdown = read("outputs/public_validation_report.md");
    const readme = read("README.md");
    const report = JSON.parse(read("outputs/public_validation_report.json")) as {
      repository: Record<string, string>;
    };

    if (markdown.includes("Visibility: public")) {
      expect(report.repository.visibility).toContain("public");
    }

    if (markdown.includes("Current-head release verification:")) {
      const conclusions = Object.entries(report.repository)
        .filter(([key]) => key.endsWith("Conclusion"))
        .map(([, value]) => value);

      expect(
        conclusions.every((value) => value.includes("verify-current-main-before-release")),
      ).toBe(true);
      expect(report.repository.lastLiveVerifiedPushedHead).toBe("release-tag-target-current-main");
      expect(markdown).toContain(report.repository.verifiedCiRunUrl);
      expect(markdown).toContain(report.repository.verifiedOsConfinementRunUrl);
      expect(markdown).toContain(report.repository.verifiedContainerConfinementRunUrl);
      expect(markdown).toContain(report.repository.verifiedSubmittedArtifactRunnerRunUrl);
      expect(markdown).toContain("public `1.0.0-rc.0` candidate");
      expect(markdown).toContain("GitHub Release tag target");
      expect(markdown).toContain("TruffleHog filesystem and git-history scans");
      expect(markdown).toContain("self-referential run IDs");
      expect(markdown).toContain("1.0.0-rc.0");
      expect(readme).toContain("actions/workflows/ci.yml/badge.svg");
      expect(markdown).not.toContain("Visibility: private");
      expect(markdown).not.toContain("private `1.0.0-rc.0` candidate");
      expect(JSON.stringify(report)).not.toContain("private-release-candidate");
      expect(JSON.stringify(report)).not.toContain("pending-final");
      expect(markdown).not.toContain("e5873d16");
      expect(markdown).not.toContain("a045744");
      expect(markdown).not.toContain("0d4fdbc");
      expect(markdown).not.toContain("v0.18 private release-candidate evidence");
      expect(JSON.stringify(report)).not.toContain("e5873d16");
      expect(JSON.stringify(report)).not.toContain("a045744");
      expect(JSON.stringify(report)).not.toContain("0d4fdbc");
    }
  });

  it("ships credential-free Hugging Face Space materials", () => {
    const files = [
      "huggingface/space/README.md",
      "huggingface/space/app.py",
      "huggingface/space/requirements.txt",
      "huggingface/space/sovereignty_frontier_report.json",
      "huggingface/space/sovereignty_frontier.svg",
    ];

    for (const file of files) {
      expect(existsSync(resolve(root, file))).toBe(true);
    }

    const app = read("huggingface/space/app.py");
    expect(app).toContain("gradio");
    expect(app).toContain("dataset_preview.jsonl");
    expect(app).toContain("sovereignty_frontier_report.json");
    expect(app).toContain("frontier_rows");
    expect(app).not.toMatch(/HF_TOKEN|OPENAI_API_KEY|api_key|password|secret/i);
  });
});
