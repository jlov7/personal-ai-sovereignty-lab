import { describe, expect, it } from "vitest";
import {
  buildAnnotationPacketV2,
  classifyRun,
  type ClassifiedRun
} from "../src/evals/annotationPacketV2";
import {
  buildInterRaterReportV2,
  krippendorffAlphaNominal
} from "../src/evals/interRaterReportV2";
import { buildHarnessRuns } from "../src/evals/harnessReport";
import { scenarios } from "../src/scenarios/library";

async function classifiedHarnessRuns(): Promise<ClassifiedRun[]> {
  const runs = await buildHarnessRuns(scenarios);
  return runs.map((record) => ({
    record,
    sourcePath: `outputs/harness_runs/${record.agentId}__${record.scenarioId}.jsonl`,
    stratum: classifyRun(record)
  }));
}

describe("annotation v2 pipeline", () => {
  it("samples a deterministic 20/20/20 blind packet when all strata exist", async () => {
    const runs = await classifiedHarnessRuns();
    const first = buildAnnotationPacketV2(runs, 20260611);
    const second = buildAnnotationPacketV2(runs, 20260611);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.cases).toHaveLength(60);
    expect(first.actualCounts).toEqual({
      automated_pass: 20,
      automated_fail: 20,
      boundary: 20
    });
  });

  it("keeps automated scores, leak findings, run ids, and agent ids out of packet cases", async () => {
    const packet = buildAnnotationPacketV2(await classifiedHarnessRuns(), 20260611);
    const serializedCases = JSON.stringify(packet.cases);

    expect(serializedCases).not.toContain("score");
    expect(serializedCases).not.toContain("leakFindings");
    expect(serializedCases).not.toContain("confirmedLeaks");
    expect(serializedCases).not.toContain("leakMatches");
    expect(serializedCases).not.toContain("runId");
    expect(serializedCases).not.toContain("agentId");
    expect(serializedCases).not.toContain("centralized-negative-control");
    expect(serializedCases).not.toContain("reference-policy");
  });

  it("matches the canonical nominal Krippendorff alpha worked example", () => {
    const rows = [
      [null, null, null, null, null, 3, 4, 1, 2, 1, 1, 3, 3, null, 3],
      [1, null, 2, 1, 3, 3, 4, 3, null, null, null, null, null, null, null],
      [null, null, 2, 1, 3, 4, 4, null, 2, 1, 1, 3, 3, null, 4]
    ];
    const units = Array.from({ length: rows[0].length }, (_, index) => rows.map((row) => row[index]));

    expect(krippendorffAlphaNominal(units)).toBeCloseTo(0.691, 3);
  });

  it("reports blocked_external with zero private annotations", async () => {
    const report = buildInterRaterReportV2([], (await classifiedHarnessRuns()).slice(0, 60).map((entry, index) => ({
      caseId: `annv2-${entry.record.scenarioId}-${String(index + 1).padStart(2, "0")}`,
      stratum: entry.stratum,
      record: entry.record,
      sourcePath: entry.sourcePath
    })));

    expect(report.status).toBe("blocked_external");
    expect(report.metrics.every((metric) => metric.value === null)).toBe(true);
    expect(report.blockers).toContain("Raw annotation files belong in private/annotations/ and must not be committed.");
  });
});
