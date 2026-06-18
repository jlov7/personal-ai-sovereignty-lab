import type { AggregateRiskReport } from "./aggregateRiskReport";
import type { AggregateRiskProbe } from "../privacy/aggregateRisk";

export type AggregateAttackFamily =
  | "membership-inference"
  | "attribute-inference"
  | "repeated-release-differencing"
  | "rare-cohort-join"
  | "threshold-attack"
  | "noisy-release-sensitivity";

export type AggregateAttackDecision =
  | "blocked_by_existing_gate"
  | "requires_new_control"
  | "low_observed_risk";

export interface AggregateAttackCase {
  id: string;
  probeId: string;
  scenarioId: string;
  dataItemId: string;
  attackFamily: AggregateAttackFamily;
  estimatedSuccessProbability: number;
  existingDecision: string;
  attackDecision: AggregateAttackDecision;
  attackPreconditions: string[];
  syntheticTransferLimits: string[];
  requiredControls: string[];
  evidence: string[];
}

export interface AggregateAttackCard {
  scenarioId: string;
  dataItemIds: string[];
  attackFamilies: AggregateAttackFamily[];
  highestEstimatedSuccessProbability: number;
  highestRiskDecision: AggregateAttackDecision;
  nonDpLabel: "not_differential_privacy";
  reviewerQuestion: string;
}

export interface PrivacyAccountingNonClaim {
  label: "not_differential_privacy";
  privacyBudgetUnit: "synthetic_risk_points";
  formalEpsilonProvided: false;
  accountingInterpretation: string;
  requiredBeforeDpClaim: string[];
}

export interface AggregateAttackReport {
  benchmark: string;
  version: string;
  generatedAt: string;
  attackFamilies: AggregateAttackFamily[];
  attackCount: number;
  blockedByExistingGate: number;
  requiresNewControl: number;
  lowObservedRisk: number;
  highestEstimatedSuccessProbability: number;
  privacyAccounting: PrivacyAccountingNonClaim;
  attackCards: AggregateAttackCard[];
  attacks: AggregateAttackCase[];
  limitations: string[];
}

const attackFamilies: AggregateAttackFamily[] = [
  "membership-inference",
  "attribute-inference",
  "repeated-release-differencing",
  "rare-cohort-join",
  "threshold-attack",
  "noisy-release-sensitivity"
];

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function probabilityFor(probe: AggregateRiskProbe, family: AggregateAttackFamily): number {
  const kRisk = Math.max(0, 1 - probe.kAnonymityEstimate / 20);
  const cohortRisk = Math.max(0, 1 - probe.syntheticCohortSize / 80);
  const piiRisk = probe.linkabilityFactors.includes("contains_pii") ? 0.3 : 0;
  const regulatedRisk = probe.linkabilityFactors.includes("regulated_domain") ? 0.18 : 0;
  const federatedRisk = probe.linkabilityFactors.includes("federated_release_surface") ? 0.12 : 0;
  const baseByFamily: Record<AggregateAttackFamily, number> = {
    "membership-inference": 0.12 + cohortRisk * 0.35 + kRisk * 0.28 + piiRisk + federatedRisk,
    "attribute-inference": 0.14 + kRisk * 0.35 + regulatedRisk + piiRisk,
    "repeated-release-differencing": 0.11 + kRisk * 0.3 + cohortRisk * 0.28 + federatedRisk,
    "rare-cohort-join": 0.16 + kRisk * 0.5 + cohortRisk * 0.2 + piiRisk,
    "threshold-attack": 0.1 + kRisk * 0.32 + regulatedRisk + federatedRisk,
    "noisy-release-sensitivity": 0.08 + cohortRisk * 0.25 + kRisk * 0.22 + federatedRisk
  };

  return round(Math.min(0.98, Math.max(0.01, baseByFamily[family])));
}

function decisionFor(
  probe: AggregateRiskProbe,
  estimatedSuccessProbability: number
): AggregateAttackDecision {
  if (probe.recommendedDecision === "block_aggregate") {
    return "blocked_by_existing_gate";
  }
  if (estimatedSuccessProbability >= 0.35) {
    return "requires_new_control";
  }
  return "low_observed_risk";
}

function preconditionsFor(probe: AggregateRiskProbe, family: AggregateAttackFamily): string[] {
  const common = [
    `synthetic_cohort_size=${probe.syntheticCohortSize}`,
    `k_estimate=${probe.kAnonymityEstimate}`
  ];
  const byFamily: Record<AggregateAttackFamily, string[]> = {
    "membership-inference": [
      "attacker has a candidate person and auxiliary context",
      "aggregate release is stable enough to compare candidate inclusion"
    ],
    "attribute-inference": [
      "attacker knows quasi-identifiers for a target",
      "released aggregate correlates with a sensitive attribute"
    ],
    "repeated-release-differencing": [
      "attacker can observe overlapping releases over time",
      "release windows differ by a small number of records"
    ],
    "rare-cohort-join": [
      "target belongs to a rare cohort",
      "attacker can join released aggregate buckets with outside context"
    ],
    "threshold-attack": [
      "release policy uses a hard threshold",
      "attacker can query or observe cohorts around the threshold"
    ],
    "noisy-release-sensitivity": [
      "release uses deterministic or weakly calibrated noise",
      "attacker can average repeated noisy releases or exploit small noise scale"
    ]
  };
  return [...common, ...byFamily[family]];
}

function transferLimitsFor(family: AggregateAttackFamily): string[] {
  return [
    "synthetic metadata is not evidence of real-world attack success",
    "probability is a deterministic risk proxy, not a calibrated empirical estimate",
    `${family} needs consented realistic data and privacy review before public validation`
  ];
}

function requiredControlsFor(probe: AggregateRiskProbe, family: AggregateAttackFamily): string[] {
  const controls = new Set<string>();
  if (probe.kAnonymityEstimate < 20) controls.add("minimum cohort and cell-size thresholds");
  if (probe.linkabilityFactors.includes("contains_pii")) controls.add("remove or coarsen PII-bearing joins");
  if (probe.linkabilityFactors.includes("federated_release_surface")) controls.add("release cadence limits");
  if (family === "repeated-release-differencing") controls.add("non-overlap or privacy budget composition");
  if (family === "threshold-attack") controls.add("threshold smoothing and query auditing");
  if (family === "noisy-release-sensitivity") controls.add("formal DP noise calibration before any DP claim");
  if (controls.size === 0) controls.add("human privacy review before release");
  return [...controls];
}

function attackCase(probe: AggregateRiskProbe, attackFamily: AggregateAttackFamily): AggregateAttackCase {
  const estimatedSuccessProbability = probabilityFor(probe, attackFamily);
  return {
    id: `${probe.id}-${attackFamily}`,
    probeId: probe.id,
    scenarioId: probe.scenarioId,
    dataItemId: probe.dataItemId,
    attackFamily,
    estimatedSuccessProbability,
    existingDecision: probe.recommendedDecision,
    attackDecision: decisionFor(probe, estimatedSuccessProbability),
    attackPreconditions: preconditionsFor(probe, attackFamily),
    syntheticTransferLimits: transferLimitsFor(attackFamily),
    requiredControls: requiredControlsFor(probe, attackFamily),
    evidence: [
      `synthetic_cohort_size=${probe.syntheticCohortSize}`,
      `k_estimate=${probe.kAnonymityEstimate}`,
      `risk_score=${probe.reconstructionRiskScore}`,
      `factors=${probe.linkabilityFactors.join(",") || "none"}`
    ]
  };
}

function attackCards(attacks: AggregateAttackCase[]): AggregateAttackCard[] {
  const byScenario = new Map<string, AggregateAttackCase[]>();
  for (const attack of attacks) {
    byScenario.set(attack.scenarioId, [...(byScenario.get(attack.scenarioId) ?? []), attack]);
  }

  return [...byScenario.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([scenarioId, scenarioAttacks]) => {
      const highest = [...scenarioAttacks].sort(
        (a, b) => b.estimatedSuccessProbability - a.estimatedSuccessProbability
      )[0];
      return {
        scenarioId,
        dataItemIds: [...new Set(scenarioAttacks.map((attack) => attack.dataItemId))].sort(),
        attackFamilies: [...new Set(scenarioAttacks.map((attack) => attack.attackFamily))].sort(),
        highestEstimatedSuccessProbability: highest.estimatedSuccessProbability,
        highestRiskDecision: highest.attackDecision,
        nonDpLabel: "not_differential_privacy",
        reviewerQuestion:
          "Would an attacker with plausible auxiliary context be able to infer membership, attributes, or small-cohort facts from this aggregate release?"
      };
    });
}

export function buildAggregateAttackReport(
  aggregateRiskReport: AggregateRiskReport
): AggregateAttackReport {
  const attacks = aggregateRiskReport.probes.flatMap((probe) =>
    attackFamilies.map((family) => attackCase(probe, family))
  );
  const blockedByExistingGate = attacks.filter(
    (attack) => attack.attackDecision === "blocked_by_existing_gate"
  ).length;
  const requiresNewControl = attacks.filter(
    (attack) => attack.attackDecision === "requires_new_control"
  ).length;
  const lowObservedRisk = attacks.filter(
    (attack) => attack.attackDecision === "low_observed_risk"
  ).length;

  return {
    benchmark: "personal-ai-sovereignty-benchmark",
    version: "0.18.0-aggregate-privacy-attacks",
    generatedAt: new Date("2026-05-23T00:00:00.000Z").toISOString(),
    attackFamilies,
    attackCount: attacks.length,
    blockedByExistingGate,
    requiresNewControl,
    lowObservedRisk,
    highestEstimatedSuccessProbability: Math.max(
      ...attacks.map((attack) => attack.estimatedSuccessProbability)
    ),
    privacyAccounting: {
      label: "not_differential_privacy",
      privacyBudgetUnit: "synthetic_risk_points",
      formalEpsilonProvided: false,
      accountingInterpretation:
        "The report tracks deterministic synthetic risk pressure only. It does not provide epsilon, delta, composition accounting, or a formal DP guarantee.",
      requiredBeforeDpClaim: [
        "define adjacency relation and release mechanism",
        "calibrate noise to a formal epsilon/delta budget",
        "account for composition across repeated releases",
        "validate implementation against privacy-library or cryptographic review"
      ]
    },
    attackCards: attackCards(attacks),
    attacks,
    limitations: [
      "This is an attack-shaped synthetic stress test, not empirical privacy research.",
      "Estimated success probabilities are deterministic heuristics over scenario metadata.",
      "The privacy accounting label is explicitly not differential privacy.",
      "A frontier-grade benchmark still needs real reconstruction or linkage attacks against realistic aggregates."
    ]
  };
}

export function renderAggregateAttackMarkdown(report: AggregateAttackReport): string {
  const topAttacks = [...report.attacks]
    .sort((a, b) => b.estimatedSuccessProbability - a.estimatedSuccessProbability)
    .slice(0, 25);

  return `# Aggregate Attack Report

Generated by \`pnpm eval\`.

## Summary

- Attack cases: ${report.attackCount}
- Attack families: ${report.attackFamilies.join(", ")}
- Attack cards: ${report.attackCards.length}
- Blocked by existing aggregate gate: ${report.blockedByExistingGate}
- Require new control: ${report.requiresNewControl}
- Low observed synthetic risk: ${report.lowObservedRisk}
- Highest estimated attack success probability: ${report.highestEstimatedSuccessProbability}
- Privacy accounting label: ${report.privacyAccounting.label}
- Formal epsilon provided: ${report.privacyAccounting.formalEpsilonProvided}

## Highest-Risk Synthetic Attacks

| Attack | Scenario | Data Item | Family | Probability | Decision | Preconditions | Required Controls | Evidence |
| --- | --- | --- | --- | ---: | --- | --- | --- | --- |
${topAttacks
  .map(
    (attack) =>
      `| ${attack.id} | ${attack.scenarioId} | ${attack.dataItemId} | ${attack.attackFamily} | ${attack.estimatedSuccessProbability} | ${attack.attackDecision} | ${attack.attackPreconditions.join("; ")} | ${attack.requiredControls.join("; ")} | ${attack.evidence.join("; ")} |`
  )
  .join("\n")}

## Scenario Attack Cards

| Scenario | Data Items | Families | Highest Probability | Highest Decision | Label |
| --- | --- | --- | ---: | --- | --- |
${report.attackCards
  .map(
    (card) =>
      `| ${card.scenarioId} | ${card.dataItemIds.join(", ")} | ${card.attackFamilies.join(", ")} | ${card.highestEstimatedSuccessProbability} | ${card.highestRiskDecision} | ${card.nonDpLabel} |`
  )
  .join("\n")}

## Privacy Accounting Non-Claim

${report.privacyAccounting.accountingInterpretation}

Required before any differential-privacy claim:

${report.privacyAccounting.requiredBeforeDpClaim.map((item) => `- ${item}`).join("\n")}

## Interpretation

This report intentionally assumes an attacker with auxiliary context. It is meant to prevent "safe aggregate" from becoming a magic phrase. Any aggregate that survives this synthetic report still needs empirical privacy review before public benchmark claims.

## Limitations

${report.limitations.map((limitation) => `- ${limitation}`).join("\n")}
`;
}
