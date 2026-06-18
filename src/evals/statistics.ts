import type { EvaluationResult, ScoreMetric } from "../shared/types";
import { clamp } from "./scorer";

export interface MetricDistribution {
  metricId: ScoreMetric["id"];
  label: string;
  mean: number;
  min: number;
  p10: number;
  median: number;
  p90: number;
  max: number;
}

export interface BootstrapMeanInterval {
  confidence: number;
  resamples: number;
  lower: number;
  mean: number;
  upper: number;
}

export interface SensitivityRow {
  id: string;
  description: string;
  weightOverrides: Partial<Record<ScoreMetric["id"], number>>;
  averageScore: number;
  deltaFromBase: number;
  weakestScenarioId: string;
  weakestScenarioScore: number;
}

export interface DetectableEffectEstimate {
  targetMeanDifference: number;
  assumedStdDev: number;
  alpha: number;
  power: number;
  pairedScenarioCountNeeded: number;
  currentScenarioCountSufficient: boolean;
  interpretation: string;
}

export interface StatisticalReport {
  benchmark: string;
  version: string;
  generatedAt: string;
  scenarioCount: number;
  scoreDistribution: {
    mean: number;
    min: number;
    p10: number;
    median: number;
    p90: number;
    max: number;
  };
  bootstrapMeanInterval: BootstrapMeanInterval;
  metricDistributions: MetricDistribution[];
  weakestScenarios: Array<{
    scenarioId: string;
    totalScore: number;
    grade: EvaluationResult["grade"];
  }>;
  detectableEffectEstimates: DetectableEffectEstimate[];
  sensitivityRows: SensitivityRow[];
  maxSensitivitySwing: number;
  interpretation: string[];
  limitations: string[];
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function sampleStdDev(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }
  const average = mean(values);
  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) {
    return sorted[lower];
  }

  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function makeDeterministicRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function bootstrapMeanInterval(
  values: number[],
  options: { resamples?: number; confidence?: number; seed?: number } = {}
): BootstrapMeanInterval {
  const resamples = options.resamples ?? 1_000;
  const confidence = options.confidence ?? 0.9;
  const random = makeDeterministicRandom(options.seed ?? 20260522);
  const bootstrapMeans: number[] = [];

  for (let sampleIndex = 0; sampleIndex < resamples; sampleIndex += 1) {
    const sample: number[] = [];
    for (let valueIndex = 0; valueIndex < values.length; valueIndex += 1) {
      sample.push(values[Math.floor(random() * values.length)]);
    }
    bootstrapMeans.push(mean(sample));
  }

  const alpha = 1 - confidence;

  return {
    confidence,
    resamples,
    lower: round(percentile(bootstrapMeans, alpha / 2), 2),
    mean: round(mean(values), 2),
    upper: round(percentile(bootstrapMeans, 1 - alpha / 2), 2)
  };
}

function summarizeValues(values: number[]): StatisticalReport["scoreDistribution"] {
  return {
    mean: round(mean(values), 2),
    min: round(Math.min(...values), 1),
    p10: round(percentile(values, 0.1), 1),
    median: round(percentile(values, 0.5), 1),
    p90: round(percentile(values, 0.9), 1),
    max: round(Math.max(...values), 1)
  };
}

function weightedScore(
  result: EvaluationResult,
  overrides: Partial<Record<ScoreMetric["id"], number>>
): number {
  const numerator = result.metrics.reduce((sum, metric) => {
    const weight = overrides[metric.id] ?? metric.weight;
    return sum + metric.score * weight;
  }, 0);
  const denominator = result.metrics.reduce(
    (sum, metric) => sum + (overrides[metric.id] ?? metric.weight),
    0
  );

  // Mirror the production scorer's integer clamp so the equal-weight "base" row
  // reproduces each scenario's published totalScore exactly. Without this, the
  // base sensitivity average diverged from the headline mean (90.95 vs 91.06).
  return clamp(numerator / Math.max(1, denominator));
}

function buildSensitivityRows(results: EvaluationResult[]): SensitivityRow[] {
  const configurations: Array<{
    id: string;
    description: string;
    weightOverrides: Partial<Record<ScoreMetric["id"], number>>;
  }> = [
    {
      id: "base",
      description: "Published equal-weight scorecard",
      weightOverrides: {}
    },
    {
      id: "privacy_x2",
      description: "Privacy preservation carries double weight",
      weightOverrides: { privacy_preservation: 2 }
    },
    {
      id: "minimization_x2",
      description: "Data minimization carries double weight",
      weightOverrides: { data_minimization: 2 }
    },
    {
      id: "autonomy_x2",
      description: "Autonomy appropriateness carries double weight",
      weightOverrides: { autonomy_appropriateness: 2 }
    },
    {
      id: "usefulness_x2",
      description: "Usefulness carries double weight",
      weightOverrides: { usefulness: 2 }
    },
    {
      id: "latency_downweighted",
      description: "Latency is downweighted to 0.2 because current latency is approximated",
      weightOverrides: { latency: 0.2 }
    },
    {
      id: "consent_x2",
      description: "Consented escalation carries double weight",
      weightOverrides: { consented_escalation: 2 }
    }
  ];
  const rows = configurations.map((configuration) => {
    const rescored = results.map((result) => ({
      scenarioId: result.scenarioId,
      score: weightedScore(result, configuration.weightOverrides)
    }));
    const weakest = [...rescored].sort((a, b) => a.score - b.score)[0];
    const averageScore = round(mean(rescored.map((row) => row.score)), 2);

    return {
      id: configuration.id,
      description: configuration.description,
      weightOverrides: configuration.weightOverrides,
      averageScore,
      deltaFromBase: 0,
      weakestScenarioId: weakest.scenarioId,
      weakestScenarioScore: weakest.score
    };
  });
  const baseAverage = rows.find((row) => row.id === "base")?.averageScore ?? 0;

  return rows.map((row) => ({
    ...row,
    deltaFromBase: round(row.averageScore - baseAverage, 2)
  }));
}

function buildDetectableEffectEstimates(scores: number[]): DetectableEffectEstimate[] {
  const assumedStdDev = Math.max(1, round(sampleStdDev(scores), 2));
  const alpha = 0.05;
  const power = 0.8;
  const zAlphaTwoSided = 1.96;
  const zPower = 0.84;

  return [2, 3, 5, 8].map((targetMeanDifference) => {
    const pairedScenarioCountNeeded = Math.ceil(
      ((zAlphaTwoSided + zPower) * assumedStdDev / targetMeanDifference) ** 2
    );
    return {
      targetMeanDifference,
      assumedStdDev,
      alpha,
      power,
      pairedScenarioCountNeeded,
      currentScenarioCountSufficient: scores.length >= pairedScenarioCountNeeded,
      interpretation: scores.length >= pairedScenarioCountNeeded
        ? `The current synthetic suite is large enough to flag a ${targetMeanDifference}-point paired mean difference under this simplified assumption.`
        : `The current synthetic suite is underpowered for a ${targetMeanDifference}-point paired mean difference under this simplified assumption.`
    };
  });
}

export function buildStatisticalReport(results: EvaluationResult[]): StatisticalReport {
  const scores = results.map((result) => result.totalScore);
  const metricIds = results[0]?.metrics.map((metric) => metric.id) ?? [];
  const sensitivityRows = buildSensitivityRows(results);
  const baseAverage = sensitivityRows.find((row) => row.id === "base")?.averageScore ?? 0;
  const maxSensitivitySwing = Math.max(
    ...sensitivityRows.map((row) => Math.abs(row.averageScore - baseAverage))
  );

  return {
    benchmark: "personal-ai-sovereignty-lab-synthetic-v0",
    version: "0.5.0-local-statistical-scaffold",
    generatedAt: new Date("2026-05-22T00:00:00.000Z").toISOString(),
    scenarioCount: results.length,
    scoreDistribution: summarizeValues(scores),
    bootstrapMeanInterval: bootstrapMeanInterval(scores),
    metricDistributions: metricIds.map((metricId) => {
      const sampleMetric = results[0]?.metrics.find((metric) => metric.id === metricId);
      const values = results.map((result) => {
        const metric = result.metrics.find((candidate) => candidate.id === metricId);
        return metric?.score ?? 0;
      });

      return {
        metricId,
        label: sampleMetric?.label ?? metricId,
        ...summarizeValues(values)
      };
    }),
    weakestScenarios: [...results]
      .sort((a, b) => a.totalScore - b.totalScore)
      .slice(0, 8)
      .map((result) => ({
        scenarioId: result.scenarioId,
        totalScore: result.totalScore,
        grade: result.grade
      })),
    detectableEffectEstimates: buildDetectableEffectEstimates(scores),
    sensitivityRows,
    maxSensitivitySwing: round(maxSensitivitySwing, 2),
    interpretation: [
      "Bootstrap intervals estimate uncertainty across synthetic scenarios, not population uncertainty over real user tasks.",
      "Sensitivity rows expose whether conclusions depend on a single subjective metric weight.",
      "Detectable-effect estimates are simplified paired-design diagnostics for benchmark sizing, not claims about real-world statistical power.",
      "The report is most useful as a regression and benchmark-design diagnostic until independent human labels exist."
    ],
    limitations: [
      "Scenario fixtures are synthetic and not sampled from a validated population.",
      "Metric scores come from a deterministic rubric, so intervals do not measure annotator disagreement.",
      "Latency is approximated by fixture complexity rather than measured model runtime."
    ]
  };
}

export function renderStatisticalReportMarkdown(report: StatisticalReport): string {
  return `# Statistical Report

Generated by \`pnpm eval\`.

## Summary

- Scenario count: ${report.scenarioCount}
- Mean score: ${report.scoreDistribution.mean}/100
- Median score: ${report.scoreDistribution.median}/100
- Score range: ${report.scoreDistribution.min}-${report.scoreDistribution.max}
- Descriptive scenario-spread interval (bootstrap over the deterministic scenario scores; not a sampling confidence interval over real user tasks): ${
    report.bootstrapMeanInterval.lower
  }-${report.bootstrapMeanInterval.upper}
- Maximum average-score swing under sensitivity checks: ${report.maxSensitivitySwing}

## Metric Distributions

| Metric | Mean | P10 | Median | P90 | Range |
| --- | ---: | ---: | ---: | ---: | --- |
${report.metricDistributions
  .map(
    (metric) =>
      `| ${metric.label} | ${metric.mean} | ${metric.p10} | ${metric.median} | ${metric.p90} | ${metric.min}-${metric.max} |`
  )
  .join("\n")}

## Weight Sensitivity

| Configuration | Average | Delta | Weakest Scenario |
| --- | ---: | ---: | --- |
${report.sensitivityRows
  .map(
    (row) =>
      `| ${row.description} | ${row.averageScore} | ${row.deltaFromBase} | ${row.weakestScenarioId} (${row.weakestScenarioScore}) |`
  )
  .join("\n")}

## Detectable Effect Estimates

| Target Mean Difference | Assumed Std Dev | Alpha | Power | Scenario Count Needed | Current Suite Sufficient |
| ---: | ---: | ---: | ---: | ---: | --- |
${report.detectableEffectEstimates
  .map(
    (row) =>
      `| ${row.targetMeanDifference} | ${row.assumedStdDev} | ${row.alpha} | ${row.power} | ${row.pairedScenarioCountNeeded} | ${row.currentScenarioCountSufficient ? "yes" : "no"} |`
  )
  .join("\n")}

## Weakest Scenarios

${report.weakestScenarios
  .map((scenario) => `- ${scenario.scenarioId}: ${scenario.totalScore}/100 (${scenario.grade})`)
  .join("\n")}

## Interpretation

${report.interpretation.map((item) => `- ${item}`).join("\n")}

## Limitations

${report.limitations.map((item) => `- ${item}`).join("\n")}
`;
}
