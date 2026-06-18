import { describe, expect, it } from "vitest";
import {
  buildAnnotationAgreementReport,
  type HumanAnnotation
} from "../src/evals/annotationAgreement";

const baseAnnotation: HumanAnnotation = {
  annotationId: "case-one-review-a",
  annotatorId: "reviewer-a",
  scenarioId: "insurance-appeal-helper",
  modelName: "gemma4:26b",
  annotatorRole: "privacy_reviewer",
  scores: {
    taskUsefulness: 4,
    privacyBoundaryRespect: 4,
    consentClarity: 4,
    autonomyAppropriateness: 4,
    explanationQuality: 4
  },
  flags: [],
  notes: "Seed annotation used to exercise the agreement report."
};

describe("annotation agreement report", () => {
  it("keeps seed-only annotation evidence marked as insufficient", () => {
    const report = buildAnnotationAgreementReport([baseAnnotation], [
      "examples/human_annotation.example.json"
    ]);

    expect(report.status).toBe("insufficient_data");
    expect(report.annotationCount).toBe(1);
    expect(report.metrics.every((metric) => metric.value === null)).toBe(true);
    expect(report.blockers.join(" ")).toContain("Fewer than three independent annotators");
  });

  it("computes pairwise agreement only when enough overlapping annotations exist", () => {
    const annotations = Array.from({ length: 5 }).flatMap((_, caseIndex) =>
      ["a", "b", "c"].map((reviewer, reviewerIndex): HumanAnnotation => ({
        ...baseAnnotation,
        annotationId: `case-${caseIndex + 1}-review-${reviewer}`,
        annotatorId: `reviewer-${reviewer}`,
        scenarioId: `scenario-${caseIndex + 1}`,
        scores: {
          ...baseAnnotation.scores,
          taskUsefulness: reviewerIndex === 0 ? 5 : 4
        }
      }))
    );
    const report = buildAnnotationAgreementReport(annotations, ["synthetic-test"]);

    expect(report.status).toBe("computed");
    expect(report.reviewerCount).toBe(3);
    expect(report.overlappingCaseCount).toBe(5);
    expect(report.metrics.find((metric) => metric.id === "pairwise_exact_score_agreement")?.value).not.toBeNull();
  });
});
