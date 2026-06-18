import type { BaselineComparisonRow, BaselineId } from "./baselines";
import type { BaselineSubmissionReport } from "./baselineSubmission";
import type { SubmittedArtifactRunnerReport } from "./submittedArtifactRunnerReport";

export type BaselineLeaderboardEvidenceClass =
  | "internal_deterministic_adapter"
  | "submitted_artifact_fixture"
  | "external_required";

export type BaselineLeaderboardScoreType =
  | "benchmark_score"
  | "runner_pass_rate"
  | "not_available";

export interface BaselineLeaderboardEntry {
  adapterId: string;
  displayName: string;
  evidenceClass: BaselineLeaderboardEvidenceClass;
  runnableCommand: string | null;
  adapterPath: string | null;
  scenarioCoverageCount: number;
  scenarioCoverageRate: number;
  scoreType: BaselineLeaderboardScoreType;
  score: number | null;
  scoreComparableToBenchmark: boolean;
  status: "active_seed" | "blocked_external";
  limitations: string[];
}

export interface StrongBaselineGate {
  id: string;
  status: "pass_local" | "blocked_external";
  evidence: string;
  requiredForValidationClaim: boolean;
  interpretation: string;
}

export interface BaselineLeaderboardReport {
  benchmark: "personal-ai-sovereignty-benchmark";
  version: "0.18.0-baseline-leaderboard";
  generatedAt: string;
  totalScenarioCount: number;
  entries: BaselineLeaderboardEntry[];
  gates: StrongBaselineGate[];
  blockedStrongBaselineClaim: boolean;
  localOpenAiCompatibleWrapper: {
    docsPath: "docs/baseline_adapters.md";
    requiredEnvironmentVariables: string[];
    nonClaim: string;
  };
  limitations: string[];
}

const GENERATED_AT = new Date("2026-05-23T00:00:00.000Z").toISOString();

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function averageScore(rows: BaselineComparisonRow[], baselineId: BaselineId): number {
  const matches = rows.filter((row) => row.baselineId === baselineId);
  return round(matches.reduce((sum, row) => sum + row.totalScore, 0) / Math.max(1, matches.length));
}

function deterministicEntry(
  baselineRows: BaselineComparisonRow[],
  baselineId: BaselineId,
  displayName: string,
  totalScenarioCount: number,
  limitations: string[]
): BaselineLeaderboardEntry {
  return {
    adapterId: baselineId,
    displayName,
    evidenceClass: "internal_deterministic_adapter",
    runnableCommand: "pnpm eval",
    adapterPath: "src/evals/baselines.ts",
    scenarioCoverageCount: totalScenarioCount,
    scenarioCoverageRate: 1,
    scoreType: "benchmark_score",
    score: averageScore(baselineRows, baselineId),
    scoreComparableToBenchmark: true,
    status: "active_seed",
    limitations
  };
}

function submittedArtifactEntry(
  submittedArtifactRunnerReport: SubmittedArtifactRunnerReport,
  totalScenarioCount: number
): BaselineLeaderboardEntry {
  const coveredScenarios = new Set(
    submittedArtifactRunnerReport.receipts.map((receipt) => receipt.scenarioId)
  );
  const passRate = round(
    (submittedArtifactRunnerReport.passedSubmissionCount /
      Math.max(1, submittedArtifactRunnerReport.submissionCount)) *
      100
  );

  return {
    adapterId: "submitted_artifact_fixture",
    displayName: "Submitted Artifact Fixture Adapter",
    evidenceClass: "submitted_artifact_fixture",
    runnableCommand: "pnpm submitted:runner",
    adapterPath: "src/evals/submittedArtifactRunnerReport.ts",
    scenarioCoverageCount: coveredScenarios.size,
    scenarioCoverageRate: round(coveredScenarios.size / totalScenarioCount),
    scoreType: "runner_pass_rate",
    score: passRate,
    scoreComparableToBenchmark: false,
    status: "active_seed",
    limitations: [
      "Runner pass rate is not a benchmark score.",
      "Current submitted artifacts are author fixtures, not independent external baselines.",
      "Coverage is limited to fixture scenarios until outside systems submit artifacts."
    ]
  };
}

export function buildBaselineLeaderboardReport(
  baselineRows: BaselineComparisonRow[],
  baselineSubmissionReport: BaselineSubmissionReport,
  submittedArtifactRunnerReport: SubmittedArtifactRunnerReport,
  totalScenarioCount: number
): BaselineLeaderboardReport {
  const entries: BaselineLeaderboardEntry[] = [
    deterministicEntry(baselineRows, "sovereign_hybrid", "Sovereign Hybrid Reference", totalScenarioCount, [
      "Author-defined policy reference, not an independent baseline."
    ]),
    deterministicEntry(
      baselineRows,
      "brokered_tool_agent",
      "Brokered Tool-Agent Adapter",
      totalScenarioCount,
      ["Deterministic local tool-agent simulation, not a production personal agent."]
    ),
    deterministicEntry(
      baselineRows,
      "centralized_cloud",
      "Centralized Cloud Negative Control",
      totalScenarioCount,
      ["Negative control intentionally collapses data boundaries."]
    ),
    deterministicEntry(baselineRows, "local_only", "Local-Only Negative Control", totalScenarioCount, [
      "Negative control intentionally refuses useful consented boundary crossing."
    ]),
    submittedArtifactEntry(submittedArtifactRunnerReport, totalScenarioCount),
    {
      adapterId: "strong_external_personal_agent",
      displayName: "Strong External Personal-Agent Baseline",
      evidenceClass: "external_required",
      runnableCommand: null,
      adapterPath: null,
      scenarioCoverageCount: 0,
      scenarioCoverageRate: 0,
      scoreType: "not_available",
      score: null,
      scoreComparableToBenchmark: true,
      status: "blocked_external",
      limitations: [
        "Requires an independently submitted production or frontier-adjacent personal-agent system.",
        "Must include action traces, consent evidence, and artifact bundle metadata."
      ]
    }
  ];

  const gates: StrongBaselineGate[] = [
    {
      id: "strong-independent-baseline-required",
      status:
        baselineSubmissionReport.externalSubmissionCount > 0 &&
        baselineSubmissionReport.productionSubmissionCount > 0
          ? "pass_local"
          : "blocked_external",
      evidence: `${baselineSubmissionReport.externalSubmissionCount} independent external submissions; ${baselineSubmissionReport.productionSubmissionCount} production personal-agent submissions`,
      requiredForValidationClaim: true,
      interpretation:
        "A public validation claim requires at least one independent production-grade or frontier-adjacent personal-agent baseline."
    },
    {
      id: "submitted-artifact-adapter-runnable",
      status: submittedArtifactRunnerReport.passedSubmissionCount > 0 ? "pass_local" : "blocked_external",
      evidence: `${submittedArtifactRunnerReport.passedSubmissionCount}/${submittedArtifactRunnerReport.submissionCount} submitted artifact fixtures passed`,
      requiredForValidationClaim: false,
      interpretation:
        "The submitted-artifact adapter is runnable locally, but fixture success does not count as an external strong baseline."
    }
  ];

  return {
    benchmark: "personal-ai-sovereignty-benchmark",
    version: "0.18.0-baseline-leaderboard",
    generatedAt: GENERATED_AT,
    totalScenarioCount,
    entries,
    gates,
    blockedStrongBaselineClaim: gates.some(
      (gate) => gate.requiredForValidationClaim && gate.status === "blocked_external"
    ),
    localOpenAiCompatibleWrapper: {
      docsPath: "docs/baseline_adapters.md",
      requiredEnvironmentVariables: ["OPENAI_BASE_URL", "OPENAI_API_KEY", "PAISL_BASELINE_MODEL"],
      nonClaim:
        "The wrapper is a maintainer convenience for local OpenAI-compatible endpoints; checked-in results remain fixture evidence unless independently submitted."
    },
    limitations: [
      "Internal deterministic baselines are useful negative controls but not external evidence.",
      "Deterministic entry scores come from the baseline-adapter run; the headline mean in README.md and outputs/statistical_report.md comes from the separate reference-policy scorecard run, so the two averages differ slightly by construction.",
      "Submitted-artifact fixture pass rates are not comparable to scorecard averages.",
      "The leaderboard must remain blocked for validation claims until strong independent systems submit trace-bearing artifacts."
    ]
  };
}

export function renderBaselineLeaderboardMarkdown(report: BaselineLeaderboardReport): string {
  return `# Baseline Leaderboard Report

Generated by \`pnpm eval\`.

## Summary

- Total scenarios: ${report.totalScenarioCount}
- Leaderboard entries: ${report.entries.length}
- Strong baseline validation claim blocked: ${report.blockedStrongBaselineClaim}
- OpenAI-compatible wrapper docs: \`${report.localOpenAiCompatibleWrapper.docsPath}\`

## Entries

| Adapter | Evidence Class | Runnable | Coverage | Score Type | Score | Comparable | Status |
| --- | --- | --- | ---: | --- | ---: | --- | --- |
${report.entries
  .map(
    (entry) =>
      `| ${entry.displayName} | ${entry.evidenceClass} | ${entry.runnableCommand ?? "external"} | ${entry.scenarioCoverageCount}/${report.totalScenarioCount} | ${entry.scoreType} | ${entry.score ?? "n/a"} | ${entry.scoreComparableToBenchmark} | ${entry.status} |`
  )
  .join("\n")}

## Strong Baseline Gates

| Gate | Status | Required For Validation Claim | Evidence | Interpretation |
| --- | --- | --- | --- | --- |
${report.gates
  .map(
    (gate) =>
      `| ${gate.id} | ${gate.status} | ${gate.requiredForValidationClaim} | ${gate.evidence} | ${gate.interpretation} |`
  )
  .join("\n")}

## Wrapper Non-Claim

${report.localOpenAiCompatibleWrapper.nonClaim}

## Limitations

${report.limitations.map((limitation) => `- ${limitation}`).join("\n")}
`;
}
