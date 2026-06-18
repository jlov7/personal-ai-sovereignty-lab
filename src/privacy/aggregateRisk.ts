import type { DataItem, Scenario } from "../shared/types";

export type AggregateRiskDecision =
  | "allow_aggregate"
  | "require_dp_or_larger_cohort"
  | "block_aggregate";

export interface AggregateRiskProbe {
  id: string;
  scenarioId: string;
  dataItemId: string;
  aggregateForm: string;
  syntheticCohortSize: number;
  kAnonymityEstimate: number;
  linkabilityFactors: string[];
  reconstructionRiskScore: number;
  recommendedDecision: AggregateRiskDecision;
  controls: string[];
  interpretation: string;
}

function syntheticCohortSize(scenario: Scenario, item: DataItem): number {
  const layerMultiplier = item.allowedLayers.includes("federated") ? 8 : 5;
  const domainPenalty =
    scenario.domain === "health_like_sensitive" || scenario.domain === "finance_like_planning"
      ? -8
      : scenario.domain === "household_admin"
        ? -4
        : 0;
  return Math.max(3, item.dataVolume * layerMultiplier + scenario.dataItems.length * 3 + domainPenalty);
}

function linkabilityFactors(scenario: Scenario, item: DataItem, cohortSize: number): string[] {
  return [
    item.containsPii ? "contains_pii" : null,
    item.sensitivity === "regulated" ? "regulated_domain" : null,
    item.sensitivity === "sensitive" ? "sensitive_domain" : null,
    item.sensitivity === "confidential" ? "confidential_context" : null,
    cohortSize < 20 ? "small_synthetic_cohort" : null,
    scenario.externalInteraction ? "external_interaction_context" : null,
    item.allowedLayers.includes("federated") ? "federated_release_surface" : null
  ].filter((factor): factor is string => Boolean(factor));
}

function riskScore(item: DataItem, factors: string[], cohortSize: number): number {
  const base = Math.max(5, 70 - Math.min(60, cohortSize));
  const factorPenalty = factors.reduce((sum, factor) => {
    if (factor === "contains_pii") return sum + 45;
    if (factor === "regulated_domain") return sum + 24;
    if (factor === "sensitive_domain") return sum + 18;
    if (factor === "confidential_context") return sum + 14;
    if (factor === "small_synthetic_cohort") return sum + 22;
    if (factor === "external_interaction_context") return sum + 8;
    if (factor === "federated_release_surface") return sum + 10;
    return sum;
  }, 0);
  const minimizationCredit = item.defaultBoundary === "safe_aggregate" && !item.containsPii ? 18 : 0;
  return Math.max(0, Math.min(100, base + factorPenalty - minimizationCredit));
}

function decisionFor(score: number, item: DataItem): AggregateRiskDecision {
  if (item.containsPii || score >= 75) {
    return "block_aggregate";
  }
  if (score >= 35) {
    return "require_dp_or_larger_cohort";
  }
  return "allow_aggregate";
}

function controlsFor(decision: AggregateRiskDecision, factors: string[]): string[] {
  const controls = ["aggregate-only", "no-raw-records", "scenario-level-provenance"];
  if (decision !== "allow_aggregate") {
    controls.push("increase-cohort-size", "add-differential-privacy-noise", "run-linkage-attack-test");
  }
  if (decision === "block_aggregate") {
    controls.push("block-release");
  }
  if (factors.includes("federated_release_surface")) {
    controls.push("federated-release-review");
  }
  return controls;
}

export function evaluateAggregateRisk(scenario: Scenario, item: DataItem): AggregateRiskProbe {
  const cohortSize = syntheticCohortSize(scenario, item);
  const factors = linkabilityFactors(scenario, item, cohortSize);
  const score = riskScore(item, factors, cohortSize);
  const recommendedDecision = decisionFor(score, item);
  const kAnonymityEstimate = Math.max(1, Math.floor(cohortSize / Math.max(1, factors.length + 1)));

  return {
    id: `${scenario.id}-${item.id}-aggregate-risk`,
    scenarioId: scenario.id,
    dataItemId: item.id,
    aggregateForm:
      item.defaultBoundary === "safe_aggregate"
        ? "declared safe aggregate"
        : "stress-test aggregate candidate",
    syntheticCohortSize: cohortSize,
    kAnonymityEstimate,
    linkabilityFactors: factors,
    reconstructionRiskScore: score,
    recommendedDecision,
    controls: controlsFor(recommendedDecision, factors),
    interpretation:
      recommendedDecision === "allow_aggregate"
        ? "Synthetic probe allows aggregate release under current assumptions."
        : recommendedDecision === "require_dp_or_larger_cohort"
          ? "Synthetic probe requires stronger privacy controls before aggregate release."
          : "Synthetic probe blocks aggregate release because linkability or reconstruction risk is too high."
  };
}

export function evaluateAggregateRisks(scenarios: Scenario[]): AggregateRiskProbe[] {
  return scenarios.flatMap((scenario) =>
    scenario.dataItems
      .filter(
        (item) =>
          item.defaultBoundary === "safe_aggregate" ||
          item.allowedLayers.includes("federated") ||
          item.sensitivity === "regulated" ||
          item.sensitivity === "sensitive"
      )
      .map((item) => evaluateAggregateRisk(scenario, item))
  );
}
