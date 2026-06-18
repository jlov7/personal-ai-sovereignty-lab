import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

function readJson<T>(path: string): T {
  return JSON.parse(read(path)) as T;
}

function readmeNumbers(): string[] {
  const readme = read("README.md");
  const evidenceSpine = readme.slice(
    readme.indexOf("## Evidence Spine"),
    readme.indexOf("## Positioning"),
  );
  const evidenceWithoutCode = evidenceSpine
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`\n]+`/g, "");
  return [...evidenceWithoutCode.matchAll(/\b\d+(?:\.\d+)?\b/g)].map((match) => match[0]);
}

function averageScore(): string {
  const log = readJson<{ results: Array<{ totalScore: number }> }>("outputs/sample_run_log.json");
  const mean = log.results.reduce((sum, result) => sum + result.totalScore, 0) / log.results.length;
  return mean.toFixed(2);
}

describe("README numeric claims", () => {
  it("pins every README number to its generating artifact", () => {
    const scenarioGeneration = readJson<{
      curatedScenarioCount: number;
      generatedScenarioCount: number;
      publicScenarioCount: number;
    }>("outputs/scenario_generation_report.json");
    const harnessReport = readJson<{ runCount: number }>("outputs/harness_report.json");
    const frontierReport = readJson<{ liveModelRunCount: number }>(
      "outputs/sovereignty_frontier_report.json"
    );
    const annotationPacket = readJson<{ cases: unknown[] }>("outputs/annotation_packet_v2.json");
    const attackScriptReport = readJson<{ scriptCount: number }>("outputs/attack_script_report.json");
    const difficultyCalibrationReport = readJson<{ rowCount: number }>(
      "outputs/difficulty_calibration_report.json"
    );

    expect(readmeNumbers()).toEqual([
      String(scenarioGeneration.curatedScenarioCount),
      String(scenarioGeneration.generatedScenarioCount),
      String(scenarioGeneration.publicScenarioCount),
      String(harnessReport.runCount),
      String(frontierReport.liveModelRunCount),
      String(annotationPacket.cases.length),
      String(attackScriptReport.scriptCount),
      String(difficultyCalibrationReport.rowCount),
      averageScore()
    ]);
  });

  it("pins the README release version note to generated release artifacts", () => {
    const readme = read("README.md");
    const packageJson = readJson<{ version: string }>("package.json");
    const releaseChecklist = readJson<{
      version: string;
      items: Array<{ id: string; note: string }>;
    }>("outputs/release_checklist.json");

    expect(releaseChecklist.version).toBe(packageJson.version);
    expect(readme).toContain(`public release candidate is \`${packageJson.version}\``);
    expect(readme).toContain("historical evidence-lineage markers");
    expect(
      releaseChecklist.items.find((item) => item.id === "public-launch-readiness")?.note
    ).toContain("v0.18 evidence lineage");
  });
});
