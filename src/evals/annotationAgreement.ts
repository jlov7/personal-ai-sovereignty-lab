import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

export type AnnotationStatus = "insufficient_data" | "computed";

export interface HumanAnnotationScores {
  taskUsefulness: number;
  privacyBoundaryRespect: number;
  consentClarity: number;
  autonomyAppropriateness: number;
  explanationQuality: number;
}

export interface HumanAnnotation {
  annotationId: string;
  annotatorId: string;
  scenarioId: string;
  modelName: string;
  annotatorRole: string;
  scores: HumanAnnotationScores;
  flags: string[];
  notes: string;
}

export interface AnnotationAgreementCase {
  caseId: string;
  scenarioId: string;
  modelName: string;
  annotationCount: number;
  annotatorIds: string[];
  averageScores: HumanAnnotationScores;
  flags: Array<{ flag: string; count: number }>;
}

export interface AnnotationAgreementReport {
  benchmark: string;
  version: string;
  generatedAt: string;
  status: AnnotationStatus;
  sourcePaths: string[];
  annotationCount: number;
  reviewerCount: number;
  reviewerRoles: Array<{ role: string; count: number }>;
  caseCount: number;
  overlappingCaseCount: number;
  minimumReviewerCount: number;
  minimumOverlappingCaseCount: number;
  cases: AnnotationAgreementCase[];
  metrics: Array<{
    id: string;
    value: number | null;
    interpretation: string;
  }>;
  blockers: string[];
  limitations: string[];
}

const scoreKeys = [
  "taskUsefulness",
  "privacyBoundaryRespect",
  "consentClarity",
  "autonomyAppropriateness",
  "explanationQuality"
] as const;

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function averageScores(annotations: HumanAnnotation[]): HumanAnnotationScores {
  return Object.fromEntries(
    scoreKeys.map((key) => [
      key,
      round(annotations.reduce((sum, annotation) => sum + annotation.scores[key], 0) / annotations.length)
    ])
  ) as unknown as HumanAnnotationScores;
}

function counts(values: string[]): Array<{ role: string; count: number }> {
  const byValue = new Map<string, number>();
  for (const value of values) {
    byValue.set(value, (byValue.get(value) ?? 0) + 1);
  }
  return [...byValue.entries()]
    .map(([role, count]) => ({ role, count }))
    .sort((a, b) => a.role.localeCompare(b.role));
}

function flagCounts(annotations: HumanAnnotation[]): Array<{ flag: string; count: number }> {
  const byFlag = new Map<string, number>();
  for (const annotation of annotations) {
    for (const flag of annotation.flags) {
      byFlag.set(flag, (byFlag.get(flag) ?? 0) + 1);
    }
  }
  return [...byFlag.entries()]
    .map(([flag, count]) => ({ flag, count }))
    .sort((a, b) => b.count - a.count || a.flag.localeCompare(b.flag));
}

function caseKey(annotation: HumanAnnotation): string {
  return `${annotation.scenarioId}::${annotation.modelName}`;
}

function pairwiseMetric(
  cases: AnnotationAgreementCase[],
  annotationsByCase: Map<string, HumanAnnotation[]>
): { exactAgreement: number | null; meanAbsoluteDistance: number | null } {
  let exactMatches = 0;
  let comparisons = 0;
  let distanceSum = 0;
  let distanceComparisons = 0;

  for (const entry of cases) {
    const annotations = annotationsByCase.get(`${entry.scenarioId}::${entry.modelName}`) ?? [];
    if (annotations.length < 2) {
      continue;
    }

    for (let i = 0; i < annotations.length; i += 1) {
      for (let j = i + 1; j < annotations.length; j += 1) {
        for (const key of scoreKeys) {
          comparisons += 1;
          if (annotations[i].scores[key] === annotations[j].scores[key]) {
            exactMatches += 1;
          }
          distanceComparisons += 1;
          distanceSum += Math.abs(annotations[i].scores[key] - annotations[j].scores[key]);
        }
      }
    }
  }

  return {
    exactAgreement: comparisons > 0 ? round(exactMatches / comparisons) : null,
    meanAbsoluteDistance: distanceComparisons > 0 ? round(distanceSum / distanceComparisons) : null
  };
}

export async function loadHumanAnnotations(
  root: string
): Promise<{ annotations: HumanAnnotation[]; sourcePaths: string[] }> {
  const sourcePaths = ["examples/human_annotation.example.json"];
  const annotationsDir = resolve(root, "examples/annotations");
  if (existsSync(annotationsDir)) {
    const nested = (await readdir(annotationsDir))
      .filter((fileName) => fileName.endsWith(".json"))
      .sort((a, b) => a.localeCompare(b))
      .map((fileName) => `examples/annotations/${fileName}`);
    sourcePaths.push(...nested);
  }

  const annotations = await Promise.all(
    sourcePaths.map(async (sourcePath) =>
      JSON.parse(await readFile(resolve(root, sourcePath), "utf8")) as HumanAnnotation
    )
  );

  return { annotations, sourcePaths };
}

export function buildAnnotationAgreementReport(
  annotations: HumanAnnotation[],
  sourcePaths: string[]
): AnnotationAgreementReport {
  const minimumReviewerCount = 3;
  const minimumOverlappingCaseCount = 5;
  const reviewerCount = new Set(annotations.map((annotation) => annotation.annotatorId)).size;
  const annotationsByCase = new Map<string, HumanAnnotation[]>();

  for (const annotation of annotations) {
    const key = caseKey(annotation);
    annotationsByCase.set(key, [...(annotationsByCase.get(key) ?? []), annotation]);
  }

  const cases = [...annotationsByCase.entries()]
    .map(([key, caseAnnotations]) => {
      const [scenarioId, modelName] = key.split("::");
      return {
        caseId: key.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase(),
        scenarioId,
        modelName,
        annotationCount: caseAnnotations.length,
        annotatorIds: [...new Set(caseAnnotations.map((annotation) => annotation.annotatorId))].sort(),
        averageScores: averageScores(caseAnnotations),
        flags: flagCounts(caseAnnotations)
      };
    })
    .sort((a, b) => a.caseId.localeCompare(b.caseId));
  const overlappingCaseCount = cases.filter((entry) => entry.annotationCount >= 2).length;
  const enoughData =
    reviewerCount >= minimumReviewerCount && overlappingCaseCount >= minimumOverlappingCaseCount;
  const pairwise = pairwiseMetric(cases, annotationsByCase);

  return {
    benchmark: "personal-ai-sovereignty-benchmark",
    version: "0.8.0-annotation-agreement",
    generatedAt: new Date("2026-05-23T00:00:00.000Z").toISOString(),
    status: enoughData ? "computed" : "insufficient_data",
    sourcePaths,
    annotationCount: annotations.length,
    reviewerCount,
    reviewerRoles: counts(annotations.map((annotation) => annotation.annotatorRole)),
    caseCount: cases.length,
    overlappingCaseCount,
    minimumReviewerCount,
    minimumOverlappingCaseCount,
    cases,
    metrics: [
      {
        id: "pairwise_exact_score_agreement",
        value: enoughData ? pairwise.exactAgreement : null,
        interpretation:
          pairwise.exactAgreement === null
            ? "Not computed until overlapping independent annotations exist."
            : "Share of pairwise score labels that exactly match across overlapping annotations."
      },
      {
        id: "mean_absolute_score_distance",
        value: enoughData ? pairwise.meanAbsoluteDistance : null,
        interpretation:
          pairwise.meanAbsoluteDistance === null
            ? "Not computed until overlapping independent annotations exist."
            : "Average absolute difference on the 1-5 annotation scale across overlapping annotations."
      }
    ],
    blockers: enoughData
      ? []
      : [
          "Fewer than three independent annotators are present.",
          "Fewer than five cases have overlapping annotations.",
          "Checked-in annotations are seed examples and must not be reported as external validation."
        ],
    limitations: [
      "This report aggregates annotation files but does not certify annotator independence.",
      "Seed examples are included only to exercise the pipeline.",
      "A validated benchmark needs overlapping labels from independent reviewers."
    ]
  };
}

export function renderAnnotationAgreementMarkdown(report: AnnotationAgreementReport): string {
  return `# Annotation Agreement Report

Generated by \`pnpm eval\`.

## Status

- Status: \`${report.status}\`
- Annotation count: ${report.annotationCount}
- Reviewer count: ${report.reviewerCount}
- Case count: ${report.caseCount}
- Overlapping case count: ${report.overlappingCaseCount}
- Minimum reviewers: ${report.minimumReviewerCount}
- Minimum overlapping cases: ${report.minimumOverlappingCaseCount}

## Reviewer Roles

| Role | Count |
| --- | ---: |
${report.reviewerRoles.map((entry) => `| ${entry.role} | ${entry.count} |`).join("\n")}

## Metrics

| Metric | Value | Interpretation |
| --- | ---: | --- |
${report.metrics
  .map((metric) => `| ${metric.id} | ${metric.value === null ? "not computed" : metric.value} | ${metric.interpretation} |`)
  .join("\n")}

## Cases

| Case | Annotations | Annotators | Avg Usefulness | Avg Privacy | Avg Consent | Avg Autonomy | Avg Explanation | Flags |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | --- |
${report.cases
  .map(
    (entry) =>
      `| ${entry.caseId} | ${entry.annotationCount} | ${entry.annotatorIds.join(", ")} | ${entry.averageScores.taskUsefulness} | ${entry.averageScores.privacyBoundaryRespect} | ${entry.averageScores.consentClarity} | ${entry.averageScores.autonomyAppropriateness} | ${entry.averageScores.explanationQuality} | ${entry.flags.map((flag) => `${flag.flag}:${flag.count}`).join(", ") || "none"} |`
  )
  .join("\n")}

## Blockers

${report.blockers.length > 0 ? report.blockers.map((blocker) => `- ${blocker}`).join("\n") : "- None."}

## Limitations

${report.limitations.map((limitation) => `- ${limitation}`).join("\n")}
`;
}
