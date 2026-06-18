import { createHash } from "node:crypto";
import { canarySeededItems } from "../harness/canary";
import { EgressTap } from "../harness/egressTap";
import type { ConfirmedLeakFinding, HarnessRunRecord } from "../harness/types";
import type { Scenario } from "../shared/types";

export interface SubmittedHarnessRunDigest {
  runId: string;
  sha256: string;
}

export interface SubmittedHarnessSweep {
  version: "0.23.0-submitted-harness-sweep";
  records: HarnessRunRecord[];
  recordDigests: SubmittedHarnessRunDigest[];
}

export interface SubmittedHarnessSweepVerification {
  passed: boolean;
  checkedRunCount: number;
  failures: string[];
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function canonicalLeaks(leaks: readonly ConfirmedLeakFinding[]): string {
  return stableJson(
    [...leaks].sort(
      (a, b) =>
        a.scenarioId.localeCompare(b.scenarioId) ||
        a.turn - b.turn ||
        a.tool.localeCompare(b.tool) ||
        a.dataItemId.localeCompare(b.dataItemId) ||
        a.transform.localeCompare(b.transform)
    )
  );
}

function recomputeLeaks(record: HarnessRunRecord, scenario: Scenario): ConfirmedLeakFinding[] {
  const tap = new EgressTap(scenario, canarySeededItems(scenario));
  for (const egressRecord of record.egressRecords) {
    tap.record(
      egressRecord.turn,
      egressRecord.tool,
      egressRecord.layer,
      egressRecord.payload,
      egressRecord.dataItemIds,
      egressRecord.consentStateSnapshot
    );
  }
  return tap.confirmedLeaks();
}

export function createSubmittedHarnessSweep(
  records: readonly HarnessRunRecord[]
): SubmittedHarnessSweep {
  return {
    version: "0.23.0-submitted-harness-sweep",
    records: [...records],
    recordDigests: records.map((record) => ({
      runId: record.runId,
      sha256: sha256(record)
    }))
  };
}

export function verifySubmittedHarnessSweep(
  sweep: SubmittedHarnessSweep,
  scenarios: readonly Scenario[]
): SubmittedHarnessSweepVerification {
  const scenarioById = new Map(scenarios.map((scenario) => [scenario.id, scenario]));
  const digestByRunId = new Map(sweep.recordDigests.map((digest) => [digest.runId, digest.sha256]));
  const failures: string[] = [];

  for (const record of sweep.records) {
    const expectedDigest = digestByRunId.get(record.runId);
    const actualDigest = sha256(record);
    if (expectedDigest !== actualDigest) {
      failures.push(`digest mismatch for ${record.runId}`);
      continue;
    }

    const scenario = scenarioById.get(record.scenarioId);
    if (!scenario) {
      failures.push(`unknown scenario for ${record.runId}: ${record.scenarioId}`);
      continue;
    }

    const recomputedLeaks = recomputeLeaks(record, scenario);
    if (canonicalLeaks(recomputedLeaks) !== canonicalLeaks(record.leakFindings)) {
      failures.push(`leak findings do not reproduce for ${record.runId}`);
    }
  }

  return {
    passed: failures.length === 0,
    checkedRunCount: sweep.records.length,
    failures
  };
}
