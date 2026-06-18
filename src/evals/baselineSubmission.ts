import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { scenarios } from "../scenarios/library";

export type BaselineSystemType =
  | "deterministic_reference"
  | "local_model"
  | "cloud_model"
  | "tool_using_agent"
  | "production_personal_agent"
  | "negative_control";

export interface BaselineSubmission {
  submissionId: string;
  submittedAt: string;
  systemName: string;
  systemVersion: string;
  systemType: BaselineSystemType;
  submitter: {
    name: string;
    independence: "author_seed" | "independent_external" | "vendor_self_report";
  };
  runtime: {
    model: string;
    tools: string[];
    environment: string;
    networkPolicy: string;
  };
  claimBoundaries: string[];
  scenarioResults: Array<{
    scenarioId: string;
    totalScore: number;
    privacyBoundaryViolations: number;
    consentViolations: number;
    toolCalls: number;
    notes: string;
  }>;
  artifacts: {
    runLog: string | null;
    transcript: string | null;
    toolTrace: string | null;
  };
}

export interface BaselineSubmissionReport {
  benchmark: string;
  version: string;
  generatedAt: string;
  sourcePaths: string[];
  submissionCount: number;
  externalSubmissionCount: number;
  productionSubmissionCount: number;
  systemTypeCounts: Array<{ systemType: BaselineSystemType; count: number }>;
  scenarioCoverage: {
    coveredScenarioCount: number;
    totalScenarioCount: number;
    coveredScenarioRate: number;
  };
  submissions: Array<{
    submissionId: string;
    systemName: string;
    systemType: BaselineSystemType;
    independence: string;
    scenarioCount: number;
    averageScore: number;
    privacyBoundaryViolations: number;
    consentViolations: number;
    toolCalls: number;
    claimBoundaries: string[];
  }>;
  readinessChecks: Array<{
    id: string;
    result: "pass" | "blocked_external";
    evidence: string;
    interpretation: string;
  }>;
  blockers: string[];
  limitations: string[];
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function countByType(submissions: BaselineSubmission[]): Array<{ systemType: BaselineSystemType; count: number }> {
  const byType = new Map<BaselineSystemType, number>();
  for (const submission of submissions) {
    byType.set(submission.systemType, (byType.get(submission.systemType) ?? 0) + 1);
  }
  return [...byType.entries()]
    .map(([systemType, count]) => ({ systemType, count }))
    .sort((a, b) => a.systemType.localeCompare(b.systemType));
}

export async function loadBaselineSubmissions(
  root: string
): Promise<{ submissions: BaselineSubmission[]; sourcePaths: string[] }> {
  const sourcePaths = ["examples/baseline_submission.example.json"];
  const submissionsDir = resolve(root, "examples/baselines");
  if (existsSync(submissionsDir)) {
    const nested = (await readdir(submissionsDir))
      .filter((fileName) => fileName.endsWith(".json"))
      .map((fileName) => `examples/baselines/${fileName}`);
    sourcePaths.push(...nested);
  }

  const submissions = await Promise.all(
    sourcePaths.map(async (sourcePath) =>
      JSON.parse(await readFile(resolve(root, sourcePath), "utf8")) as BaselineSubmission
    )
  );

  return { submissions, sourcePaths };
}

export function buildBaselineSubmissionReport(
  submissions: BaselineSubmission[],
  sourcePaths: string[]
): BaselineSubmissionReport {
  const coveredScenarioIds = new Set(
    submissions.flatMap((submission) => submission.scenarioResults.map((result) => result.scenarioId))
  );
  const externalSubmissionCount = submissions.filter(
    (submission) => submission.submitter.independence === "independent_external"
  ).length;
  const productionSubmissionCount = submissions.filter(
    (submission) => submission.systemType === "production_personal_agent"
  ).length;
  const toolUsingSubmissionCount = submissions.filter(
    (submission) =>
      submission.systemType === "tool_using_agent" ||
      submission.systemType === "production_personal_agent" ||
      submission.runtime.tools.length > 0
  ).length;
  const reportSubmissions = submissions.map((submission) => {
    const scenarioCount = submission.scenarioResults.length;
    return {
      submissionId: submission.submissionId,
      systemName: submission.systemName,
      systemType: submission.systemType,
      independence: submission.submitter.independence,
      scenarioCount,
      averageScore: round(
        submission.scenarioResults.reduce((sum, result) => sum + result.totalScore, 0) /
          Math.max(1, scenarioCount)
      ),
      privacyBoundaryViolations: submission.scenarioResults.reduce(
        (sum, result) => sum + result.privacyBoundaryViolations,
        0
      ),
      consentViolations: submission.scenarioResults.reduce(
        (sum, result) => sum + result.consentViolations,
        0
      ),
      toolCalls: submission.scenarioResults.reduce((sum, result) => sum + result.toolCalls, 0),
      claimBoundaries: submission.claimBoundaries
    };
  });
  const totalScenarioCount = scenarios.length;
  const coveredScenarioCount = coveredScenarioIds.size;
  const readinessChecks: BaselineSubmissionReport["readinessChecks"] = [
    {
      id: "independent-external-baseline",
      result: externalSubmissionCount > 0 ? "pass" : ("blocked_external" as const),
      evidence: `${externalSubmissionCount} independent external submissions`,
      interpretation: "A credible benchmark needs systems submitted by people other than the author."
    },
    {
      id: "production-personal-agent-baseline",
      result: productionSubmissionCount > 0 ? "pass" : ("blocked_external" as const),
      evidence: `${productionSubmissionCount} production personal-agent submissions`,
      interpretation: "The scaffold still needs at least one production-grade personal-agent run."
    },
    {
      id: "tool-using-baseline",
      result: toolUsingSubmissionCount > 0 ? "pass" : ("blocked_external" as const),
      evidence: `${toolUsingSubmissionCount} submissions with tool-use evidence`,
      interpretation: "Tool traces are necessary because personal-agent failures often happen at action boundaries."
    }
  ];

  return {
    benchmark: "personal-ai-sovereignty-benchmark",
    version: "0.8.0-baseline-submission",
    generatedAt: new Date("2026-05-23T00:00:00.000Z").toISOString(),
    sourcePaths,
    submissionCount: submissions.length,
    externalSubmissionCount,
    productionSubmissionCount,
    systemTypeCounts: countByType(submissions),
    scenarioCoverage: {
      coveredScenarioCount,
      totalScenarioCount,
      coveredScenarioRate: round(coveredScenarioCount / totalScenarioCount)
    },
    submissions: reportSubmissions,
    readinessChecks,
    blockers: readinessChecks
      .filter((check) => check.result === "blocked_external")
      .map((check) => `${check.id}: ${check.interpretation}`),
    limitations: [
      "Seed baseline submissions exercise the contract but are not independent evidence.",
      "Scenario coverage from a submission report is only meaningful when run artifacts are attached.",
      "External submissions must include enough trace evidence to audit data movement, not only final scores."
    ]
  };
}

export function renderBaselineSubmissionMarkdown(report: BaselineSubmissionReport): string {
  return `# Baseline Submission Report

Generated by \`pnpm eval\`.

## Summary

- Submission count: ${report.submissionCount}
- Independent external submissions: ${report.externalSubmissionCount}
- Production personal-agent submissions: ${report.productionSubmissionCount}
- Scenario coverage: ${report.scenarioCoverage.coveredScenarioCount}/${report.scenarioCoverage.totalScenarioCount}

## System Types

| System Type | Count |
| --- | ---: |
${report.systemTypeCounts.map((entry) => `| ${entry.systemType} | ${entry.count} |`).join("\n")}

## Readiness Checks

| Check | Result | Evidence | Interpretation |
| --- | --- | --- | --- |
${report.readinessChecks
  .map((check) => `| ${check.id} | ${check.result} | ${check.evidence} | ${check.interpretation} |`)
  .join("\n")}

## Submissions

| Submission | System | Type | Independence | Scenarios | Avg Score | Privacy Violations | Consent Violations | Tool Calls |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
${report.submissions
  .map(
    (submission) =>
      `| ${submission.submissionId} | ${submission.systemName} | ${submission.systemType} | ${submission.independence} | ${submission.scenarioCount} | ${submission.averageScore} | ${submission.privacyBoundaryViolations} | ${submission.consentViolations} | ${submission.toolCalls} |`
  )
  .join("\n")}

## Blockers

${report.blockers.length > 0 ? report.blockers.map((blocker) => `- ${blocker}`).join("\n") : "- None."}

## Limitations

${report.limitations.map((limitation) => `- ${limitation}`).join("\n")}
`;
}
