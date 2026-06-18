import type { AggregateRiskReport } from "./aggregateRiskReport";
import type { AggregateRiskProbe } from "../privacy/aggregateRisk";

export type ExecutableAggregateAttackFamily =
  | "exact-differencing"
  | "unique-bucket-linkage"
  | "small-cell-reconstruction";

export type ExecutableAggregateAttackStatus =
  | "blocked_by_existing_gate"
  | "needs_release_control"
  | "no_observed_leak";

interface SyntheticAggregateRecord {
  recordId: string;
  quasiSignature: string;
  sensitiveValue: 0 | 1;
  contribution: number;
}

export interface ExecutableAggregateAttackCase {
  id: string;
  probeId: string;
  scenarioId: string;
  dataItemId: string;
  attackFamily: ExecutableAggregateAttackFamily;
  cohortSize: number;
  releaseShape: string;
  targetRecordId: string;
  targetQuasiSignature: string;
  targetSensitiveValue: 0 | 1;
  inferredSensitiveValue: 0 | 1 | null;
  attackSucceededAgainstNaiveRelease: boolean;
  existingDecision: string;
  mitigationStatus: ExecutableAggregateAttackStatus;
  evidence: string[];
}

export interface ExecutableAggregateAttackReport {
  benchmark: string;
  version: string;
  generatedAt: string;
  probeCount: number;
  attackCount: number;
  naiveSuccessCount: number;
  blockedByExistingGateCount: number;
  needsReleaseControlCount: number;
  noObservedLeakCount: number;
  attacks: ExecutableAggregateAttackCase[];
  limitations: string[];
}

const regions = ["metro", "suburban", "rural", "coastal", "industrial", "university"];
const ageBands = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
const rhythms = ["daily", "weekly", "monthly", "episodic"];

function stableHash(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

function recordFor(probe: AggregateRiskProbe, rowIndex: number): SyntheticAggregateRecord {
  const seed = stableHash(`${probe.id}:${rowIndex}`);
  const region = regions[seed % regions.length];
  const age = ageBands[Math.floor(seed / 5) % ageBands.length];
  const rhythm = rhythms[Math.floor(seed / 11) % rhythms.length];
  const domainBucket = probe.linkabilityFactors.includes("regulated_domain")
    ? `regulated-${seed % 7}`
    : probe.linkabilityFactors.includes("sensitive_domain")
      ? `sensitive-${seed % 5}`
      : `general-${seed % 4}`;
  const contextBucket = probe.linkabilityFactors.includes("external_interaction_context")
    ? `external-${seed % 6}`
    : `local-${seed % 3}`;
  const piiBucket = probe.linkabilityFactors.includes("contains_pii") ? `pii-${seed % 9}` : "no-pii";
  const sensitiveValue = ((seed + probe.reconstructionRiskScore + rowIndex) % 5 <= 1 ? 1 : 0) as 0 | 1;

  return {
    recordId: `${probe.id}-row-${rowIndex}`,
    quasiSignature: [region, age, rhythm, domainBucket, contextBucket, piiBucket].join("|"),
    sensitiveValue,
    contribution: sensitiveValue
  };
}

function recordsFor(probe: AggregateRiskProbe): SyntheticAggregateRecord[] {
  return Array.from({ length: probe.syntheticCohortSize }, (_, rowIndex) => recordFor(probe, rowIndex));
}

function countBy<T>(items: T[], keyFor: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFor(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}

function selectTarget(records: SyntheticAggregateRecord[], probe: AggregateRiskProbe): SyntheticAggregateRecord {
  return records[stableHash(probe.id) % records.length];
}

function statusFor(
  probe: AggregateRiskProbe,
  attackSucceededAgainstNaiveRelease: boolean
): ExecutableAggregateAttackStatus {
  if (probe.recommendedDecision === "block_aggregate") {
    return "blocked_by_existing_gate";
  }
  if (attackSucceededAgainstNaiveRelease) {
    return "needs_release_control";
  }
  return "no_observed_leak";
}

function exactDifferencingAttack(
  probe: AggregateRiskProbe,
  records: SyntheticAggregateRecord[],
  target: SyntheticAggregateRecord
): ExecutableAggregateAttackCase {
  const fullSum = records.reduce((sum, record) => sum + record.contribution, 0);
  const withoutTargetSum = records
    .filter((record) => record.recordId !== target.recordId)
    .reduce((sum, record) => sum + record.contribution, 0);
  const inferredSensitiveValue = (fullSum - withoutTargetSum) as 0 | 1;
  const succeeded = inferredSensitiveValue === target.sensitiveValue;

  return {
    id: `${probe.id}-exact-differencing`,
    probeId: probe.id,
    scenarioId: probe.scenarioId,
    dataItemId: probe.dataItemId,
    attackFamily: "exact-differencing",
    cohortSize: records.length,
    releaseShape: "two exact overlapping aggregate counts that differ by one target record",
    targetRecordId: target.recordId,
    targetQuasiSignature: target.quasiSignature,
    targetSensitiveValue: target.sensitiveValue,
    inferredSensitiveValue,
    attackSucceededAgainstNaiveRelease: succeeded,
    existingDecision: probe.recommendedDecision,
    mitigationStatus: statusFor(probe, succeeded),
    evidence: [
      `full_sum=${fullSum}`,
      `without_target_sum=${withoutTargetSum}`,
      `delta=${inferredSensitiveValue}`,
      "control_needed=disallow_exact_overlapping_releases_or_add_noise"
    ]
  };
}

function uniqueBucketAttack(
  probe: AggregateRiskProbe,
  records: SyntheticAggregateRecord[],
  target: SyntheticAggregateRecord
): ExecutableAggregateAttackCase {
  const bucket = records.filter((record) => record.quasiSignature === target.quasiSignature);
  const bucketSum = bucket.reduce((sum, record) => sum + record.contribution, 0);
  const inferredSensitiveValue = bucket.length === 1 ? (bucketSum as 0 | 1) : null;
  const succeeded = inferredSensitiveValue === target.sensitiveValue;

  return {
    id: `${probe.id}-unique-bucket-linkage`,
    probeId: probe.id,
    scenarioId: probe.scenarioId,
    dataItemId: probe.dataItemId,
    attackFamily: "unique-bucket-linkage",
    cohortSize: records.length,
    releaseShape: "exact count by quasi-identifier bucket",
    targetRecordId: target.recordId,
    targetQuasiSignature: target.quasiSignature,
    targetSensitiveValue: target.sensitiveValue,
    inferredSensitiveValue,
    attackSucceededAgainstNaiveRelease: succeeded,
    existingDecision: probe.recommendedDecision,
    mitigationStatus: statusFor(probe, succeeded),
    evidence: [
      `target_bucket_size=${bucket.length}`,
      `target_bucket_sum=${bucketSum}`,
      `k_estimate=${probe.kAnonymityEstimate}`,
      "control_needed=suppress_small_cells_and_coarsen_quasi_identifiers"
    ]
  };
}

function smallCellAttack(
  probe: AggregateRiskProbe,
  records: SyntheticAggregateRecord[],
  target: SyntheticAggregateRecord
): ExecutableAggregateAttackCase {
  const cells = countBy(records, (record) => `${record.quasiSignature}|sensitive=${record.sensitiveValue}`);
  const targetCell = cells.get(`${target.quasiSignature}|sensitive=${target.sensitiveValue}`) ?? [];
  const inferredSensitiveValue = targetCell.length === 1 ? target.sensitiveValue : null;
  const succeeded = inferredSensitiveValue === target.sensitiveValue;

  return {
    id: `${probe.id}-small-cell-reconstruction`,
    probeId: probe.id,
    scenarioId: probe.scenarioId,
    dataItemId: probe.dataItemId,
    attackFamily: "small-cell-reconstruction",
    cohortSize: records.length,
    releaseShape: "exact sensitive count by quasi-identifier cell",
    targetRecordId: target.recordId,
    targetQuasiSignature: target.quasiSignature,
    targetSensitiveValue: target.sensitiveValue,
    inferredSensitiveValue,
    attackSucceededAgainstNaiveRelease: succeeded,
    existingDecision: probe.recommendedDecision,
    mitigationStatus: statusFor(probe, succeeded),
    evidence: [
      `target_sensitive_cell_size=${targetCell.length}`,
      `linkability=${probe.linkabilityFactors.join(",") || "none"}`,
      `risk_score=${probe.reconstructionRiskScore}`,
      "control_needed=minimum_cell_size_threshold_and_dp_noise"
    ]
  };
}

function attackCasesFor(probe: AggregateRiskProbe): ExecutableAggregateAttackCase[] {
  const records = recordsFor(probe);
  const target = selectTarget(records, probe);

  return [
    exactDifferencingAttack(probe, records, target),
    uniqueBucketAttack(probe, records, target),
    smallCellAttack(probe, records, target)
  ];
}

export function buildExecutableAggregateAttackReport(
  aggregateRiskReport: AggregateRiskReport
): ExecutableAggregateAttackReport {
  const attacks = aggregateRiskReport.probes.flatMap((probe) => attackCasesFor(probe));
  const naiveSuccessCount = attacks.filter(
    (attack) => attack.attackSucceededAgainstNaiveRelease
  ).length;
  const blockedByExistingGateCount = attacks.filter(
    (attack) => attack.mitigationStatus === "blocked_by_existing_gate"
  ).length;
  const needsReleaseControlCount = attacks.filter(
    (attack) => attack.mitigationStatus === "needs_release_control"
  ).length;
  const noObservedLeakCount = attacks.filter(
    (attack) => attack.mitigationStatus === "no_observed_leak"
  ).length;

  return {
    benchmark: "personal-ai-sovereignty-benchmark",
    version: "0.10.0-executable-aggregate-attack",
    generatedAt: new Date("2026-05-23T00:00:00.000Z").toISOString(),
    probeCount: aggregateRiskReport.probeCount,
    attackCount: attacks.length,
    naiveSuccessCount,
    blockedByExistingGateCount,
    needsReleaseControlCount,
    noObservedLeakCount,
    attacks,
    limitations: [
      "The harness executes deterministic attacks against synthetic aggregate fixtures, not real user data.",
      "Exact differencing attacks intentionally model a naive release shape; passing this harness requires controls such as non-overlap, noise, suppression, or blocking.",
      "This improves falsifiability of aggregate-risk claims but still does not provide formal differential privacy guarantees."
    ]
  };
}

export function renderExecutableAggregateAttackMarkdown(
  report: ExecutableAggregateAttackReport
): string {
  const highestRisk = report.attacks
    .filter((attack) => attack.attackSucceededAgainstNaiveRelease)
    .slice(0, 30);

  return `# Executable Aggregate Attack Report

Generated by \`pnpm eval\`.

## Summary

- Probe count: ${report.probeCount}
- Attack count: ${report.attackCount}
- Naive release attack successes: ${report.naiveSuccessCount}
- Blocked by existing aggregate gate: ${report.blockedByExistingGateCount}
- Need release controls: ${report.needsReleaseControlCount}
- No observed leak: ${report.noObservedLeakCount}

## Successful Attacks Against Naive Releases

| Attack | Scenario | Data Item | Family | Release Shape | Inferred | Target | Mitigation Status | Evidence |
| --- | --- | --- | --- | --- | ---: | ---: | --- | --- |
${highestRisk
  .map(
    (attack) =>
      `| ${attack.id} | ${attack.scenarioId} | ${attack.dataItemId} | ${attack.attackFamily} | ${attack.releaseShape} | ${attack.inferredSensitiveValue ?? "n/a"} | ${attack.targetSensitiveValue} | ${attack.mitigationStatus} | ${attack.evidence.join("; ")} |`
  )
  .join("\n")}

## Interpretation

This report executes concrete linkage, differencing, and reconstruction-style attacks against deterministic aggregate fixtures. It is stricter than a heuristic score because every successful case includes a release shape, target record, inferred value, and mitigation status. It remains synthetic and should be used to decide which aggregate claims need real privacy review before external validation.

## Limitations

${report.limitations.map((limitation) => `- ${limitation}`).join("\n")}
`;
}
