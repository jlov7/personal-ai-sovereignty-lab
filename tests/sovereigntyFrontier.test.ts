import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildHarnessRuns } from "../src/evals/harnessReport";
import {
  buildSovereigntyFrontierReport,
  loadFrontierRunRecords,
  type FrontierRunRecordSource
} from "../src/evals/sovereigntyFrontierReport";
import { renderSovereigntyFrontierSvg } from "../src/evals/frontierFigure";
import type { HarnessRunRecord } from "../src/harness/types";
import { scenarios } from "../src/scenarios/library";

async function hermeticSources(count = 3): Promise<FrontierRunRecordSource[]> {
  const runs = await buildHarnessRuns(scenarios.slice(0, count));
  return runs.map((record) => ({
    record,
    sourcePath: `outputs/harness_runs/${record.agentId}__${record.scenarioId}.jsonl`,
    evidenceClass: "hermetic_fixture" as const,
    tier: "base_harness" as const
  }));
}

describe("sovereignty frontier report", () => {
  it("places the centralized negative control below-left of the reference policy", async () => {
    const report = buildSovereigntyFrontierReport(await hermeticSources());

    expect(report.validityControls.negativeControlBelowLeftOfReference).toBe(true);
    const reference = report.rows.find((row) => row.agentId === "reference-policy" && row.tier === "all");
    const negative = report.rows.find(
      (row) => row.agentId === "centralized-negative-control" && row.tier === "all"
    );

    expect(reference?.sovereignty).toBe(1);
    expect(reference?.usefulness).toBe(1);
    expect(negative?.sovereignty).toBe(0);
    expect(negative?.usefulness).toBeLessThan(reference?.usefulness ?? 0);
  });

  it("renders a deterministic dependency-free SVG", async () => {
    const report = buildSovereigntyFrontierReport(await hermeticSources());
    const first = renderSovereigntyFrontierSvg(report);
    const second = renderSovereigntyFrontierSvg(report);

    expect(first).toBe(second);
    expect(first).toContain("<svg");
    expect(first).toContain("Rows");
    expect(first).toContain("Task completion score");
    expect(first).toContain("not a model leaderboard");
    expect(first).toContain("reference-policy");
  });

  it("merges optional platform-tagged live model run records without changing hermetic inputs", async () => {
    const tempRoot = await mkdtemp(resolve(tmpdir(), "paisl-frontier-"));
    const harnessDir = resolve(tempRoot, "outputs/harness_runs");
    const liveDir = resolve(tempRoot, "outputs/harness_model_runs");
    await mkdir(harnessDir, { recursive: true });
    await mkdir(liveDir, { recursive: true });

    const [referenceRun, negativeRun] = await buildHarnessRuns(scenarios.slice(0, 1));
    const liveRun: HarnessRunRecord = {
      ...referenceRun,
      runId: "harness_local-model-fixture_data-rights-request",
      agentId: "local-model-fixture",
      score: {
        ...referenceRun.score,
        usefulness: 0.5,
        successChecksSatisfied: Math.max(1, Math.floor(referenceRun.score.successChecksTotal / 2))
      }
    };

    await writeFile(
      resolve(harnessDir, "reference-policy__data-rights-request.jsonl"),
      `${JSON.stringify(referenceRun)}\n`
    );
    await writeFile(
      resolve(harnessDir, "centralized-negative-control__data-rights-request.jsonl"),
      `${JSON.stringify(negativeRun)}\n`
    );
    await writeFile(resolve(liveDir, "local-model-fixture__data-rights-request.jsonl"), `${JSON.stringify(liveRun)}\n`);

    const report = buildSovereigntyFrontierReport(await loadFrontierRunRecords(tempRoot));
    const liveRow = report.rows.find((row) => row.agentId === "local-model-fixture" && row.tier === "all");

    expect(report.liveEvidence.present).toBe(true);
    expect(report.liveModelRunCount).toBe(1);
    expect(liveRow?.evidenceClass).toBe("live_model");
    expect(liveRow?.usefulness).toBe(0.5);
    expect(liveRow?.statusCounts.completed).toBe(1);
  });
});
