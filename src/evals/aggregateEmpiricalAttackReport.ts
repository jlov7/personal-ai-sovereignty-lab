import type { AggregateRiskReport } from "./aggregateRiskReport";
import type { AggregateRiskProbe } from "../privacy/aggregateRisk";

export interface AggregateEmpiricalAttackCase {
  id: string;
  probeId: string;
  scenarioId: string;
  dataItemId: string;
  cohortSize: number;
  quasiIdentifierCount: number;
  uniqueSignatureCount: number;
  uniqueSignatureRate: number;
  simulatedAttackSucceeded: boolean;
  existingDecision: string;
  mitigationStatus: "blocked_by_existing_gate" | "needs_empirical_mitigation" | "low_synthetic_uniqueness";
  evidence: string[];
}

export interface AggregateEmpiricalAttackReport {
  benchmark: string;
  version: string;
  generatedAt: string;
  probeCount: number;
  attackCount: number;
  simulatedSuccessCount: number;
  mitigatedByExistingGateCount: number;
  needsEmpiricalMitigationCount: number;
  averageUniqueSignatureRate: number;
  attacks: AggregateEmpiricalAttackCase[];
  limitations: string[];
}

const regions = ["metro", "suburban", "rural", "coastal", "industrial", "university"];
const ageBands = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
const cadence = ["daily", "weekly", "monthly", "episodic"];

function stableHash(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function signatureFor(probe: AggregateRiskProbe, rowIndex: number): string {
  const seed = stableHash(`${probe.id}:${rowIndex}`);
  const region = regions[seed % regions.length];
  const age = ageBands[Math.floor(seed / 7) % ageBands.length];
  const useCadence = cadence[Math.floor(seed / 17) % cadence.length];
  const domain =
    probe.linkabilityFactors.includes("regulated_domain") ||
    probe.linkabilityFactors.includes("sensitive_domain")
      ? `domain-${seed % 5}`
      : `domain-${seed % 3}`;
  const piiBucket = probe.linkabilityFactors.includes("contains_pii") ? `pii-${seed % 11}` : "no-pii";
  const externalBucket = probe.linkabilityFactors.includes("external_interaction_context")
    ? `external-${seed % 7}`
    : "local-context";

  return [region, age, useCadence, domain, piiBucket, externalBucket].join("|");
}

function buildAttackCase(probe: AggregateRiskProbe): AggregateEmpiricalAttackCase {
  const signatures = new Map<string, number>();
  for (let rowIndex = 0; rowIndex < probe.syntheticCohortSize; rowIndex += 1) {
    const signature = signatureFor(probe, rowIndex);
    signatures.set(signature, (signatures.get(signature) ?? 0) + 1);
  }

  const uniqueSignatureCount = [...signatures.values()].filter((count) => count === 1).length;
  const uniqueSignatureRate = Math.round((uniqueSignatureCount / probe.syntheticCohortSize) * 100) / 100;
  const simulatedAttackSucceeded =
    uniqueSignatureRate >= 0.35 ||
    (probe.kAnonymityEstimate < 10 && probe.linkabilityFactors.includes("contains_pii"));
  const mitigationStatus =
    probe.recommendedDecision === "block_aggregate"
      ? "blocked_by_existing_gate"
      : simulatedAttackSucceeded
        ? "needs_empirical_mitigation"
        : "low_synthetic_uniqueness";

  return {
    id: `${probe.id}-synthetic-cohort-join`,
    probeId: probe.id,
    scenarioId: probe.scenarioId,
    dataItemId: probe.dataItemId,
    cohortSize: probe.syntheticCohortSize,
    quasiIdentifierCount: 6,
    uniqueSignatureCount,
    uniqueSignatureRate,
    simulatedAttackSucceeded,
    existingDecision: probe.recommendedDecision,
    mitigationStatus,
    evidence: [
      `k_estimate=${probe.kAnonymityEstimate}`,
      `risk_score=${probe.reconstructionRiskScore}`,
      `linkability=${probe.linkabilityFactors.join(",") || "none"}`,
      `unique_signatures=${uniqueSignatureCount}`
    ]
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function buildAggregateEmpiricalAttackReport(
  aggregateRiskReport: AggregateRiskReport
): AggregateEmpiricalAttackReport {
  const attacks = aggregateRiskReport.probes.map((probe) => buildAttackCase(probe));
  const simulatedSuccessCount = attacks.filter((attack) => attack.simulatedAttackSucceeded).length;
  const mitigatedByExistingGateCount = attacks.filter(
    (attack) => attack.mitigationStatus === "blocked_by_existing_gate"
  ).length;
  const needsEmpiricalMitigationCount = attacks.filter(
    (attack) => attack.mitigationStatus === "needs_empirical_mitigation"
  ).length;

  return {
    benchmark: "personal-ai-sovereignty-benchmark",
    version: "0.8.0-synthetic-cohort-attack",
    generatedAt: new Date("2026-05-23T00:00:00.000Z").toISOString(),
    probeCount: aggregateRiskReport.probeCount,
    attackCount: attacks.length,
    simulatedSuccessCount,
    mitigatedByExistingGateCount,
    needsEmpiricalMitigationCount,
    averageUniqueSignatureRate: round(
      attacks.reduce((sum, attack) => sum + attack.uniqueSignatureRate, 0) /
        Math.max(1, attacks.length)
    ),
    attacks,
    limitations: [
      "This is a synthetic cohort uniqueness experiment, not an attack against real user data.",
      "Quasi-identifiers are deterministic fixtures derived from probe metadata.",
      "The report is meant to identify where empirical privacy work is required before aggregate-release claims."
    ]
  };
}

export function renderAggregateEmpiricalAttackMarkdown(
  report: AggregateEmpiricalAttackReport
): string {
  const highestRisk = [...report.attacks]
    .sort((a, b) => b.uniqueSignatureRate - a.uniqueSignatureRate || b.uniqueSignatureCount - a.uniqueSignatureCount)
    .slice(0, 25);

  return `# Synthetic Cohort Attack Report

Generated by \`pnpm eval\`.

## Summary

- Probe count: ${report.probeCount}
- Attack count: ${report.attackCount}
- Simulated attack successes: ${report.simulatedSuccessCount}
- Blocked by existing aggregate gate: ${report.mitigatedByExistingGateCount}
- Need empirical mitigation: ${report.needsEmpiricalMitigationCount}
- Average unique-signature rate: ${report.averageUniqueSignatureRate}

## Highest Synthetic Uniqueness Pressure

| Attack | Scenario | Data Item | Cohort | Unique Signatures | Unique Rate | Existing Decision | Mitigation Status | Evidence |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |
${highestRisk
  .map(
    (attack) =>
      `| ${attack.id} | ${attack.scenarioId} | ${attack.dataItemId} | ${attack.cohortSize} | ${attack.uniqueSignatureCount} | ${attack.uniqueSignatureRate} | ${attack.existingDecision} | ${attack.mitigationStatus} | ${attack.evidence.join("; ")} |`
  )
  .join("\n")}

## Interpretation

This report is stronger than a pure aggregate-risk score because it simulates whether auxiliary quasi-identifiers can create unique records inside each synthetic cohort. It is still not real privacy evidence. Any case marked \`needs_empirical_mitigation\` should be treated as a candidate for a real linkage, differencing, or reconstruction experiment before public aggregate-release claims.

## Limitations

${report.limitations.map((limitation) => `- ${limitation}`).join("\n")}
`;
}
