import type { AggregateRiskReport } from "./aggregateRiskReport";
import type { AggregateRiskProbe } from "../privacy/aggregateRisk";

export interface AggregatePrivacyChallengeCase {
  id: string;
  probeId: string;
  scenarioId: string;
  dataItemId: string;
  populationSize: number;
  targetRecordId: string;
  targetSensitiveValue: 0 | 1;
  naiveBucketSize: number;
  naiveConfidence: number;
  naiveInference: 0 | 1 | null;
  naiveAttackSucceeded: boolean;
  controlledRelease: "blocked" | "suppressed" | "coarsened_noisy_count";
  controlledBucketSize: number;
  controlledConfidence: number;
  controlledInference: 0 | 1 | null;
  controlledAttackSucceeded: boolean;
  confidenceDrop: number;
  interpretation: string;
}

export interface AggregatePrivacyChallengeReport {
  benchmark: string;
  version: string;
  generatedAt: string;
  probeCount: number;
  challengeCount: number;
  naiveSuccessCount: number;
  controlledSuccessCount: number;
  averageNaiveConfidence: number;
  averageControlledConfidence: number;
  averageConfidenceDrop: number;
  cases: AggregatePrivacyChallengeCase[];
  limitations: string[];
}

interface SemiRealisticRecord {
  id: string;
  region: string;
  ageBand: string;
  cadence: string;
  household: string;
  domainMarker: string;
  sensitiveValue: 0 | 1;
}

const regions = ["north", "south", "east", "west", "central", "coastal", "rural", "metro"];
const ageBands = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
const cadences = ["daily", "weekly", "monthly", "quarterly", "episodic"];
const households = ["solo", "couple", "family", "caregiver", "roommates"];

function stableHash(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function syntheticPopulationSize(probe: AggregateRiskProbe): number {
  const riskMultiplier = probe.reconstructionRiskScore >= 75 ? 8 : probe.reconstructionRiskScore >= 35 ? 10 : 12;
  return Math.max(96, probe.syntheticCohortSize * riskMultiplier);
}

function recordFor(probe: AggregateRiskProbe, index: number): SemiRealisticRecord {
  const seed = stableHash(`${probe.id}:privacy-challenge:${index}`);
  const sensitivePressure =
    (probe.linkabilityFactors.includes("regulated_domain") ? 2 : 0) +
    (probe.linkabilityFactors.includes("sensitive_domain") ? 1 : 0) +
    (probe.linkabilityFactors.includes("external_interaction_context") ? 1 : 0);
  const sensitiveValue = ((seed + sensitivePressure + index) % 7 <= 2 ? 1 : 0) as 0 | 1;

  return {
    id: `${probe.id}-person-${index.toString().padStart(4, "0")}`,
    region: regions[seed % regions.length],
    ageBand: ageBands[Math.floor(seed / 7) % ageBands.length],
    cadence: cadences[Math.floor(seed / 13) % cadences.length],
    household: households[Math.floor(seed / 19) % households.length],
    domainMarker: probe.linkabilityFactors.includes("regulated_domain")
      ? `regulated-${seed % 11}`
      : probe.linkabilityFactors.includes("sensitive_domain")
        ? `sensitive-${seed % 7}`
        : `general-${seed % 5}`,
    sensitiveValue
  };
}

function populationFor(probe: AggregateRiskProbe): SemiRealisticRecord[] {
  return Array.from({ length: syntheticPopulationSize(probe) }, (_, index) => recordFor(probe, index));
}

function naiveSignature(record: SemiRealisticRecord): string {
  return [
    record.region,
    record.ageBand,
    record.cadence,
    record.household,
    record.domainMarker
  ].join("|");
}

function controlledSignature(record: SemiRealisticRecord): string {
  return [record.region, record.ageBand, record.domainMarker.split("-")[0]].join("|");
}

function deterministicNoise(probe: AggregateRiskProbe, bucketSize: number): number {
  const raw = (stableHash(`${probe.id}:noise:${bucketSize}`) % 5) - 2;
  return raw / 2;
}

function inferFromBucket(
  bucket: SemiRealisticRecord[],
  noisyCount = 0
): { inference: 0 | 1 | null; confidence: number } {
  if (bucket.length === 0) {
    return { inference: null, confidence: 0 };
  }
  const sensitiveCount = bucket.reduce((sum, record) => sum + record.sensitiveValue, 0) + noisyCount;
  const rate = Math.max(0, Math.min(1, sensitiveCount / bucket.length));
  const confidence = Math.abs(rate - 0.5) * 2;

  if (confidence < 0.65) {
    return { inference: null, confidence: round(confidence) };
  }

  return {
    inference: rate >= 0.5 ? 1 : 0,
    confidence: round(confidence)
  };
}

function challengeFor(probe: AggregateRiskProbe): AggregatePrivacyChallengeCase {
  const population = populationFor(probe);
  const target = population[stableHash(`${probe.id}:target`) % population.length];
  const naiveBucket = population.filter((record) => naiveSignature(record) === naiveSignature(target));
  const naive = inferFromBucket(naiveBucket);
  const naiveAttackSucceeded = naive.inference === target.sensitiveValue;

  let controlledRelease: AggregatePrivacyChallengeCase["controlledRelease"] = "coarsened_noisy_count";
  let controlledBucket: SemiRealisticRecord[] = [];
  let controlled = { inference: null as 0 | 1 | null, confidence: 0 };

  if (probe.recommendedDecision === "block_aggregate") {
    controlledRelease = "blocked";
  } else {
    controlledBucket = population.filter(
      (record) => controlledSignature(record) === controlledSignature(target)
    );
    if (controlledBucket.length < 5) {
      controlledRelease = "suppressed";
    }
    if (controlledRelease === "coarsened_noisy_count") {
      controlled = inferFromBucket(controlledBucket, deterministicNoise(probe, controlledBucket.length));
    }
  }

  const controlledAttackSucceeded = controlled.inference === target.sensitiveValue;
  const confidenceDrop = round(Math.max(0, naive.confidence - controlled.confidence));

  return {
    id: `${probe.id}-privacy-challenge`,
    probeId: probe.id,
    scenarioId: probe.scenarioId,
    dataItemId: probe.dataItemId,
    populationSize: population.length,
    targetRecordId: target.id,
    targetSensitiveValue: target.sensitiveValue,
    naiveBucketSize: naiveBucket.length,
    naiveConfidence: naive.confidence,
    naiveInference: naive.inference,
    naiveAttackSucceeded,
    controlledRelease,
    controlledBucketSize: controlledBucket.length,
    controlledConfidence: controlled.confidence,
    controlledInference: controlled.inference,
    controlledAttackSucceeded,
    confidenceDrop,
    interpretation: controlledAttackSucceeded
      ? "Controlled release still permits target inference and needs stronger privacy treatment."
      : naiveAttackSucceeded
        ? "Naive release leaks target signal; controlled release prevents this deterministic inference."
        : "No deterministic target inference was observed for the naive or controlled release."
  };
}

export function buildAggregatePrivacyChallengeReport(
  aggregateRiskReport: AggregateRiskReport
): AggregatePrivacyChallengeReport {
  const cases = aggregateRiskReport.probes.map((probe) => challengeFor(probe));
  const naiveSuccessCount = cases.filter((entry) => entry.naiveAttackSucceeded).length;
  const controlledSuccessCount = cases.filter((entry) => entry.controlledAttackSucceeded).length;
  const averageNaiveConfidence =
    cases.reduce((sum, entry) => sum + entry.naiveConfidence, 0) / Math.max(1, cases.length);
  const averageControlledConfidence =
    cases.reduce((sum, entry) => sum + entry.controlledConfidence, 0) / Math.max(1, cases.length);
  const averageConfidenceDrop =
    cases.reduce((sum, entry) => sum + entry.confidenceDrop, 0) / Math.max(1, cases.length);

  return {
    benchmark: "personal-ai-sovereignty-benchmark",
    version: "0.13.0-aggregate-privacy-challenge",
    generatedAt: new Date("2026-05-23T00:00:00.000Z").toISOString(),
    probeCount: aggregateRiskReport.probeCount,
    challengeCount: cases.length,
    naiveSuccessCount,
    controlledSuccessCount,
    averageNaiveConfidence: round(averageNaiveConfidence),
    averageControlledConfidence: round(averageControlledConfidence),
    averageConfidenceDrop: round(averageConfidenceDrop),
    cases,
    limitations: [
      "The challenge uses deterministic semi-realistic synthetic microdata, not consented real user records.",
      "The controlled release uses simple coarsening, suppression, and deterministic noise; it is a privacy stress test, not a formal differential privacy mechanism.",
      "A validated benchmark still needs attacks run by independent reviewers against realistic aggregate-release proposals."
    ]
  };
}

export function renderAggregatePrivacyChallengeMarkdown(
  report: AggregatePrivacyChallengeReport
): string {
  const topRows = [...report.cases]
    .sort((a, b) => b.confidenceDrop - a.confidenceDrop)
    .slice(0, 30)
    .map(
      (entry) =>
        `| ${entry.scenarioId} | ${entry.dataItemId} | ${entry.naiveAttackSucceeded} | ${entry.controlledAttackSucceeded} | ${entry.naiveBucketSize} | ${entry.controlledBucketSize} | ${entry.naiveConfidence} | ${entry.controlledConfidence} | ${entry.controlledRelease} |`
    )
    .join("\n");

  return `# Aggregate Privacy Challenge Report

Generated by \`pnpm eval\`.

## Summary

- Probe count: ${report.probeCount}
- Challenge count: ${report.challengeCount}
- Naive target-inference successes: ${report.naiveSuccessCount}
- Controlled target-inference successes: ${report.controlledSuccessCount}
- Average naive confidence: ${report.averageNaiveConfidence}
- Average controlled confidence: ${report.averageControlledConfidence}
- Average confidence drop: ${report.averageConfidenceDrop}

## Highest Confidence Drops

| Scenario | Data Item | Naive Success | Controlled Success | Naive Bucket | Controlled Bucket | Naive Confidence | Controlled Confidence | Controlled Release |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |
${topRows}

## Interpretation

This report turns aggregate privacy from a label into an empirical challenge over deterministic synthetic microdata. It compares a naive exact aggregate release with a controlled release that blocks, suppresses, coarsens, or adds deterministic noise according to the aggregate-risk decision. It is stronger than metadata-only scoring because it measures target inference before and after controls.

## Limitations

${report.limitations.map((limitation) => `- ${limitation}`).join("\n")}
`;
}
