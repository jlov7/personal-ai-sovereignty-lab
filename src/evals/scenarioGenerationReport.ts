import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { evaluateRun } from "./scorer";
import { runAgent } from "../agent/runAgent";
import type { EvaluationResult, Scenario } from "../shared/types";
import {
  GENERATED_SAMPLE_COUNT,
  GENERATED_SAMPLE_SEED,
  GENERATOR_VERSION,
  NEAR_DUPLICATE_THRESHOLD,
  PUBLIC_GENERATION_SEED
} from "../generator/grammar";
import { mulberry32, sampleWithoutReplacement } from "../generator/prng";

export interface HoldoutCommitment {
  sha256OfSeedFile: string;
  count: number;
  generatorVersion: string;
  grammarHash: string;
}

export interface PublicReferenceAggregate {
  scenarioCount: number;
  meanScore: number;
  minScore: number;
  maxScore: number;
  weakestScenarioIds: string[];
}

export interface GeneratedScenarioSample {
  seed: number;
  count: number;
  scenarioIds: string[];
  scorecards: Array<{
    scenarioId: string;
    totalScore: number;
    grade: EvaluationResult["grade"];
    failureCaseCount: number;
  }>;
}

export interface ScenarioGenerationReport {
  benchmark: "personal-ai-sovereignty-benchmark";
  version: "0.22.0-scenario-generation";
  generatedAt: string;
  generatorVersion: string;
  publicGenerationSeed: number;
  duplicateThreshold: number;
  curatedScenarioCount: number;
  generatedScenarioCount: number;
  publicScenarioCount: number;
  grammarHash: string;
  holdoutCommitment: HoldoutCommitment;
  publicReferenceAggregate: PublicReferenceAggregate;
  generatedScenarioSample: GeneratedScenarioSample;
  limitations: string[];
}

const GENERATED_AT = new Date("2026-06-11T00:00:00.000Z").toISOString();
const HOLDOUT_SEED_FILE_SHA256 = "581f122ae8e9a4b70529b48db5e93424e24c8cef3a8ba3b687110e9d1dd2bf92";
const HOLDOUT_SEED_COUNT = 128;

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

async function sha256File(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

function aggregate(results: EvaluationResult[]): PublicReferenceAggregate {
  const scores = results.map((result) => result.totalScore);
  const weakestScenarioIds = [...results]
    .sort((a, b) => a.totalScore - b.totalScore || a.scenarioId.localeCompare(b.scenarioId))
    .slice(0, 5)
    .map((result) => result.scenarioId);

  return {
    scenarioCount: results.length,
    meanScore: round(scores.reduce((sum, score) => sum + score, 0) / Math.max(1, scores.length)),
    minScore: Math.min(...scores),
    maxScore: Math.max(...scores),
    weakestScenarioIds
  };
}

function sampleGeneratedScenarios(generatedScenarios: readonly Scenario[]): Scenario[] {
  const sorted = [...generatedScenarios].sort((a, b) => a.id.localeCompare(b.id));
  return sampleWithoutReplacement(
    mulberry32(GENERATED_SAMPLE_SEED),
    sorted,
    Math.min(GENERATED_SAMPLE_COUNT, sorted.length)
  ).sort((a, b) => a.id.localeCompare(b.id));
}

export async function buildHoldoutCommitment(root: string): Promise<HoldoutCommitment> {
  const grammarHash = await sha256File(resolve(root, "src/generator/grammar.ts"));
  return {
    sha256OfSeedFile: HOLDOUT_SEED_FILE_SHA256,
    count: HOLDOUT_SEED_COUNT,
    generatorVersion: GENERATOR_VERSION,
    grammarHash
  };
}

export async function buildScenarioGenerationReport(
  root: string,
  inputs: {
    curatedScenarios: readonly Scenario[];
    generatedScenarios: readonly Scenario[];
    publicScenarios: readonly Scenario[];
  }
): Promise<ScenarioGenerationReport> {
  const publicResults = inputs.publicScenarios.map((scenario) => evaluateRun(runAgent(scenario)));
  const generatedSample = sampleGeneratedScenarios(inputs.generatedScenarios);
  const generatedSampleResults = generatedSample.map((scenario) => evaluateRun(runAgent(scenario)));
  const holdoutCommitment = await buildHoldoutCommitment(root);

  return {
    benchmark: "personal-ai-sovereignty-benchmark",
    version: "0.22.0-scenario-generation",
    generatedAt: GENERATED_AT,
    generatorVersion: GENERATOR_VERSION,
    publicGenerationSeed: PUBLIC_GENERATION_SEED,
    duplicateThreshold: NEAR_DUPLICATE_THRESHOLD,
    curatedScenarioCount: inputs.curatedScenarios.length,
    generatedScenarioCount: inputs.generatedScenarios.length,
    publicScenarioCount: inputs.publicScenarios.length,
    grammarHash: holdoutCommitment.grammarHash,
    holdoutCommitment,
    publicReferenceAggregate: aggregate(publicResults),
    generatedScenarioSample: {
      seed: GENERATED_SAMPLE_SEED,
      count: generatedSample.length,
      scenarioIds: generatedSample.map((scenario) => scenario.id),
      scorecards: generatedSampleResults.map((result) => ({
        scenarioId: result.scenarioId,
        totalScore: result.totalScore,
        grade: result.grade,
        failureCaseCount: result.failureCases.length
      }))
    },
    limitations: [
      "Generated scenarios are synthetic fixtures produced from a public template grammar.",
      "The public grammar can be studied or trained against; private holdout seeds reduce exact-case exposure, not distribution exposure.",
      "The full-public aggregate is a deterministic reference-policy regression check, not a model ranking or external validation result.",
      "Only aggregate full-set statistics and a seed-pinned generated sample are written here; curated per-scenario scorecards remain in the legacy reports."
    ]
  };
}

export function renderScenarioGenerationMarkdown(report: ScenarioGenerationReport): string {
  return `# Scenario Generation Report

Generated by \`pnpm eval\`.

## Summary

- Generator version: ${report.generatorVersion}
- Public generation seed: ${report.publicGenerationSeed}
- Curated scenarios: ${report.curatedScenarioCount}
- Generated public scenarios: ${report.generatedScenarioCount}
- Public scenario corpus: ${report.publicScenarioCount}
- Near-duplicate threshold: ${report.duplicateThreshold}
- Grammar SHA-256: \`${report.grammarHash}\`

## Holdout Commitment

- Holdout seed-file SHA-256: \`${report.holdoutCommitment.sha256OfSeedFile}\`
- Holdout seed count: ${report.holdoutCommitment.count}
- Generator version: ${report.holdoutCommitment.generatorVersion}
- Grammar SHA-256: \`${report.holdoutCommitment.grammarHash}\`

## Full Public Reference-Policy Aggregate

- Scenario count: ${report.publicReferenceAggregate.scenarioCount}
- Mean score: ${report.publicReferenceAggregate.meanScore}
- Min score: ${report.publicReferenceAggregate.minScore}
- Max score: ${report.publicReferenceAggregate.maxScore}
- Weakest scenarios: ${report.publicReferenceAggregate.weakestScenarioIds.join(", ")}

## Generated Scenario Sample

- Sample seed: ${report.generatedScenarioSample.seed}
- Sample count: ${report.generatedScenarioSample.count}

| Scenario | Score | Grade | Failure cases |
| --- | ---: | --- | ---: |
${report.generatedScenarioSample.scorecards
  .map(
    (scorecard) =>
      `| ${scorecard.scenarioId} | ${scorecard.totalScore} | ${scorecard.grade} | ${scorecard.failureCaseCount} |`
  )
  .join("\n")}

## Limitations

${report.limitations.map((limitation) => `- ${limitation}`).join("\n")}
`;
}
