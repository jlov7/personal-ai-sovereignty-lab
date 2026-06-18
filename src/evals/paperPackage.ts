import type { Scenario } from "../shared/types";
import type { AggregateAttackReport } from "./aggregateAttackReport";
import type { AttackScriptReport } from "./attackScriptReport";
import type { BaselineComparisonRow } from "./baselines";
import type { BaselineLeaderboardReport } from "./baselineLeaderboardReport";
import type { DifficultyCalibrationReport } from "./difficultyCalibrationReport";
import type { ExternalValidationGateReport } from "./externalValidationGate";
import type { HarnessReport } from "./harnessReport";
import type { InterRaterReportV2 } from "./interRaterReportV2";
import type { KeyCustodyReport } from "./keyCustodyReport";
import type { MeasurementValidityReport } from "./measurementValidityReport";
import type { RunnerHardeningReport } from "./runnerHardeningReport";
import type { ScenarioProvenanceReport } from "./scenarioProvenanceReport";
import type { EvaluationResult } from "../shared/types";
import type { ScenarioGenerationReport } from "./scenarioGenerationReport";
import type { StatisticalReport } from "./statistics";
import type { SubmittedArtifactRunnerReport } from "./submittedArtifactRunnerReport";
import type { SovereigntyFrontierReport } from "./sovereigntyFrontierReport";

export interface PaperPackageInputs {
  scenarios: Scenario[];
  results: EvaluationResult[];
  baselineRows: BaselineComparisonRow[];
  statisticalReport: StatisticalReport;
  measurementValidityReport: MeasurementValidityReport;
  scenarioProvenanceReport: ScenarioProvenanceReport;
  aggregateAttackReport: AggregateAttackReport;
  baselineLeaderboardReport: BaselineLeaderboardReport;
  keyCustodyReport: KeyCustodyReport;
  runnerHardeningReport: RunnerHardeningReport;
  submittedArtifactRunnerReport: SubmittedArtifactRunnerReport;
  externalValidationGateReport: ExternalValidationGateReport;
  harnessReport: HarnessReport;
  attackScriptReport: AttackScriptReport;
  difficultyCalibrationReport?: DifficultyCalibrationReport | null;
  sovereigntyFrontierReport: SovereigntyFrontierReport;
  interRaterReportV2: InterRaterReportV2;
  annotationPacketV2CaseCount: number;
  scenarioGenerationReport: ScenarioGenerationReport;
}

export interface PaperPackageArtifacts {
  paperDraft: string;
  benchmarkReleaseCard: string;
  systemCard: string;
  figuresAndTables: string;
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function rounded(value: number, digits = 1): string {
  return value.toFixed(digits);
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return count === 1 ? singular : pluralForm;
}

function countBy<T extends string>(values: T[]): Record<T, number> {
  return values.reduce(
    (counts, value) => ({
      ...counts,
      [value]: (counts[value] ?? 0) + 1
    }),
    {} as Record<T, number>
  );
}

function markdownRows(entries: Array<[string, string | number]>): string {
  return `| Field | Value |
| --- | --- |
${entries.map(([key, value]) => `| ${key} | ${value} |`).join("\n")}`;
}

function baselineAverages(rows: BaselineComparisonRow[]): Array<[string, string]> {
  const ids = [...new Set(rows.map((row) => row.baselineId))].sort();
  return ids.map((id) => {
    const matching = rows.filter((row) => row.baselineId === id);
    return [id, rounded(average(matching.map((row) => row.totalScore)), 1)];
  });
}

function scenarioDomainRows(scenarios: Scenario[]): Array<[string, number]> {
  const counts = countBy(scenarios.map((scenario) => scenario.domain));
  return Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)) as Array<[string, number]>;
}

function sensitivityRows(scenarios: Scenario[]): Array<[string, number]> {
  const sensitivities = scenarios.flatMap((scenario) => scenario.dataItems.map((item) => item.sensitivity));
  return Object.entries(countBy(sensitivities)).sort(([a], [b]) => a.localeCompare(b)) as Array<
    [string, number]
  >;
}

function frontierRows(report: SovereigntyFrontierReport): string {
  return report.rows
    .filter((row) => row.tier === "all")
    .map((row) => {
      const statusCounts = Object.entries(row.statusCounts)
        .map(([status, count]) => `${status}:${count}`)
        .join("<br>");
      return `| ${row.agentId} | ${row.evidenceClass} | ${row.runCount} | ${row.slr.toFixed(4)} | ${row.sovereignty.toFixed(4)} | ${row.usefulness.toFixed(4)} | ${statusCounts} |`;
    })
    .join("\n");
}

function difficultyCalibrationSummary(report: DifficultyCalibrationReport | null | undefined): string {
  if (!report) {
    return "Live difficulty calibration remains pending.";
  }

  const strongest = report.strongestConfiguredModel
    ? `${report.strongestConfiguredModel.modelId} at ${report.strongestConfiguredModel.passRate.toFixed(4)}`
    : "none";
  const allStatusCounts = report.models[0]?.tiers.find((tier) => tier.tier === "all")?.statusCounts;
  const statusSummary = allStatusCounts
    ? ` Status counts are completed:${allStatusCounts.completed}, limit_exceeded:${allStatusCounts.limit_exceeded}, format_failure:${allStatusCounts.format_failure}, so non-passing runs should not be read as proven boundary robustness.`
    : "";
  return `The committed difficulty calibration report covers ${report.rowCount} platform-tagged live local-model ${plural(report.rowCount, "run")} across ${report.scriptCount} deterministic ${plural(report.scriptCount, "script")} and ${report.modelCount} configured ${plural(report.modelCount, "model")}. The strongest configured model is ${strongest}; the saturation guard ${report.saturationGuard.passed ? "passes" : "fails"} its target of pass rate < ${report.saturationGuard.targetMaxPassRateExclusive}. This remains configured local-model evidence, not a general model ranking.${statusSummary}`;
}

function difficultyCalibrationRows(report: DifficultyCalibrationReport | null | undefined): string {
  if (!report) {
    return "| pending | 0 | 0 | 0.0000 | 0.0000 |";
  }

  return report.models
    .map(
      (model) =>
        `| ${model.modelId} | ${model.runCount} | ${model.passCount} | ${model.passRate.toFixed(4)} | ${model.meanUsefulness.toFixed(4)} |`
    )
    .join("\n");
}

export function renderPaperDraft(inputs: PaperPackageInputs): string {
  const averageScore = rounded(average(inputs.results.map((result) => result.totalScore)), 2);
  const weakestScenario = [...inputs.results].sort((a, b) => a.totalScore - b.totalScore)[0];
  const blockedGateCount = inputs.externalValidationGateReport.checks.filter(
    (check) => check.result === "blocked_external"
  ).length;
  const referenceHarness = inputs.harnessReport.agents.find((agent) => agent.agentId === "reference-policy");
  const negativeHarness = inputs.harnessReport.agents.find(
    (agent) => agent.agentId === "centralized-negative-control"
  );

  return `# Personal AI Sovereignty Benchmark: A Scaffold For Evaluating User-Controlled Personal Agents

Status: paper-style draft generated by \`pnpm eval\`. This is not a peer-reviewed paper and not a validated benchmark standard.

## Abstract

Personal AI agents increasingly need to operate across raw local memory, private compute, external tools, and consent-based collective systems. Existing model-evaluation harnesses mostly score final answers or task completion, while the hard personal-agent problem also includes data-boundary choice, consent, autonomy limits, minimization, explainability, and overreach prevention. PAISL proposes a benchmark object for this setting: an evaluated agent run containing the scenario, data items, boundary decisions, action trace, consent state, scorecard, and failure cases. The current release contributes an execution-level canary harness, deterministic T2-T4 adversary scripts, a sovereignty-usefulness frontier generated from run records, and a blind human-annotation packet. The strict claim remains bounded: PAISL is a reproducible benchmark scaffold and public validation candidate, not an externally validated standard.

## 1. Introduction

A personal agent earns its usefulness by touching raw personal context: local memory, private compute, external tools, and consent-based collective systems. That creates an evaluation problem most harnesses skip. A model can produce a fluent, task-completing answer while quietly violating the user's boundaries: sending raw data to a layer it should never reach, acting without consent, or over-collecting. PAISL evaluates the whole run, not just the final text, so that boundary choice, consent, minimization, and restraint are measured rather than assumed.

The core question is whether a personal agent can stay useful while preserving user-defined data boundaries. A run is successful only when it remains useful while preserving privacy, minimizing data, respecting autonomy boundaries, explaining its decisions, and requesting consent when crossing a boundary is necessary.

## 2. Related Work And Positioning

PAISL is adjacent to general eval harnesses such as OpenAI Evals and lm-evaluation-harness, scenario-and-metric frameworks such as HELM, disclosure artifacts such as model cards and system cards, local-first software principles, privacy-preserving ML, agent-safety work on tool use and autonomy, and enterprise AI governance. The contribution is narrower than those systems: it defines a personal-agent benchmark unit where data governance and consent are primary outputs rather than metadata.

## 3. Benchmark Object

The benchmark object is an evaluated run:

1. Scenario with domain, task, user objective, data items, sensitivities, allowed layers, success criteria, and failure modes.
2. Agent action trace with local, personal-cloud, federated, and external interactions.
3. Governance decisions: local-only, requires-consent, safe-aggregate, or blocked.
4. Consent receipts and egress checks where boundary crossing is attempted.
5. Scorecard across usefulness, privacy preservation, autonomy appropriateness, explainability, latency approximation, data minimization, user-control alignment, and consented escalation.
6. Failure cases and risk notes.

## 4. Canary-Based Egress Measurement

The canary harness seeds protected data items with deterministic non-secret markers and routes every non-local release through one egress tap. This makes one important failure class objective: if a protected marker crosses into a disallowed layer, the run receives an SLR failure regardless of what the model claims it did. The current hermetic harness covers ${inputs.harnessReport.runCount} runs across ${inputs.harnessReport.scenarioCount} scenarios and ${inputs.harnessReport.agentCount} fixture agents. The reference policy has SLR ${referenceHarness?.slr.toFixed(4) ?? "pending"}; the centralized negative control has SLR ${negativeHarness?.slr.toFixed(4) ?? "pending"}. The detector is intentionally narrow: it catches verbatim and trivially encoded canary movement, not paraphrase or every side channel.

## 5. Tiered Adversary And Saturation Analysis

The adversary layer separates fixture pressure from model claims. T1 is the existing single-shot adversarial prompt pack; the harness adds deterministic T2 multi-turn escalation, T3 indirect injection, and T4 stateful or role-confusion scripts. The committed report contains ${inputs.attackScriptReport.scriptCount} scripts, and replay controls show ${inputs.attackScriptReport.replayControls.compliantResisted}/${inputs.attackScriptReport.replayControls.scriptCount} compliant-fixture resistances and ${inputs.attackScriptReport.replayControls.naiveFailed}/${inputs.attackScriptReport.replayControls.scriptCount} naive-fixture failures. ${difficultyCalibrationSummary(inputs.difficultyCalibrationReport)}

## 6. Sovereignty-Usefulness Frontier

The frontier report plots SLR-derived sovereignty against objective usefulness from execution records. This avoids treating refusal as success: a system can be leak-free and still fail if it cannot complete useful work. The current frontier uses ${inputs.sovereigntyFrontierReport.hermeticRunCount} hermetic run records and ${inputs.sovereigntyFrontierReport.liveModelRunCount} platform-tagged live model ${plural(inputs.sovereigntyFrontierReport.liveModelRunCount, "record")}. The live point is evidence of one local harness run, not a full-suite model benchmark.

## 7. Instrument Validation

The v2 annotation packet is active and blind: annotators see transcripts, tool calls, and egress summaries but not automated scores, leak findings, run ids, agent ids, or sampling strata. The current packet has ${inputs.annotationPacketV2CaseCount} cases, while the agreement report has ${inputs.interRaterReportV2.annotationCount} private annotations loaded and status \`${inputs.interRaterReportV2.status}\`. Instrument validation is pending until at least ${inputs.interRaterReportV2.minimumReviewerCount} independent reviewers label at least ${inputs.interRaterReportV2.minimumOverlappingCaseCount} overlapping cases.

## 8. Threat Model

The threat model includes privacy leakage through raw context upload, consent confusion, autonomy overreach, unsafe external negotiation, aggregate reconstruction, runner escape attempts, receipt replay, stale keys, and confused-deputy flows. Current evidence includes ${inputs.keyCustodyReport.probes.length} key-custody lifecycle probes, ${inputs.keyCustodyReport.attackProbes.length} custody attack probes, and ${inputs.runnerHardeningReport.escapeCorpus.length} runner escape-corpus cases. These are local proofs of semantics, not production security guarantees.

## 9. Limitations

The project is not validated by independent reviewers. The scored corpus is synthetic, and the public generated corpus remains templated synthetic data. The deterministic policy simulator currently averages ${averageScore}/100 across the curated scenario suite, with weakest scenario \`${weakestScenario.scenarioId}\` at ${weakestScenario.totalScore}/100; this is a self-rubric regression signal, not a benchmark result. The strongest baselines are not external production systems. Aggregate privacy tests are not formal differential privacy. Consent signatures use fixture keys. Runner hardening is local Docker/process/OS evidence, not production multi-tenant sandboxing. Hugging Face publication requires maintainer credentials.

## 10. Research Roadmap

The next research step is external evidence, not more polish: independent annotation, inter-rater agreement, strong submitted baselines, public scenario criticism, realistic aggregate attack review, production key custody, production broker execution, and a public Hugging Face dataset or Space. The current external validation gate has ${blockedGateCount} blocked checks. Any section above that says pending should block an arXiv or validation-style release until the maintainer chooses to resolve or explicitly scope it out.

## 11. Reproducibility

Core local regeneration uses:

\`\`\`bash
pnpm install
pnpm verify
pnpm submitted:runner
pnpm artifact:bundles
pnpm runner:hardening
\`\`\`

The artifact manifest binds public files by SHA-256. Public claims should be checked against \`docs/claim_evidence_index.md\` and falsified according to \`docs/falsification_criteria.md\`.

## References

- OpenAI Evals and lm-evaluation-harness for runnable evaluation patterns.
- HELM for scenario-and-metric framing.
- Model cards and system cards for disclosure structure.
- Local-first software for user-control principles.
- Privacy-preserving ML and statistical disclosure control for aggregate-release skepticism.
- Enterprise AI governance frameworks for risk, control, and residual-risk reporting.
`;
}

export function renderBenchmarkReleaseCard(inputs: PaperPackageInputs): string {
  return `# Benchmark Release Card

Generated by \`pnpm eval\`.

## Identity

${markdownRows([
  ["Project", "Personal AI Sovereignty Lab (PAISL)"],
  ["Evidence class", "deterministic benchmark scaffold and public validation candidate"],
  ["Scenario count", inputs.scenarios.length],
  ["Mutation count", inputs.scenarioProvenanceReport.mutationCount],
  ["Aggregate attack cases", inputs.aggregateAttackReport.attackCount],
  ["Leaderboard entries", inputs.baselineLeaderboardReport.entries.length]
])}

## Intended Use

- Evaluate personal-agent runs where usefulness must be balanced against privacy, consent, autonomy, and data minimization.
- Compare local-first, personal-cloud, federated, centralized, and submitted-artifact behaviors.
- Structure public review, annotation, scenario criticism, aggregate attack reports, and baseline submissions.

## Out Of Scope

- Not a validated scientific benchmark.
- Not a claim of differential privacy.
- Not production key custody, legal consent, or production sandboxing.
- Not medical, legal, financial, or benefits advice.

## Current Evidence

${markdownRows([
  ["Reference-policy self-rubric score (sanity check, not a result)", rounded(average(inputs.results.map((result) => result.totalScore)), 2)],
  ["Scenario-spread interval (descriptive, not a sampling CI)", `${inputs.statisticalReport.bootstrapMeanInterval.lower}-${inputs.statisticalReport.bootstrapMeanInterval.upper}`],
  ["Calibration metrics", inputs.measurementValidityReport.labelCalibrationPacket.metrics.length],
  ["Scenario attack cards", inputs.aggregateAttackReport.attackCards.length],
  ["Custody attack probes", inputs.keyCustodyReport.attackProbes.length],
  ["Runner escape cases", inputs.runnerHardeningReport.escapeCorpus.length],
  ["Submitted-artifact submissions", inputs.submittedArtifactRunnerReport.submissionCount]
])}

## Validation Gate

The release remains blocked for validation claims while independent annotations, strong submitted baselines, realistic aggregate attacks, and public review are absent. See \`outputs/external_validation_gate.md\` and \`outputs/public_validation_report.md\`.
`;
}

export function renderSystemCard(inputs: PaperPackageInputs): string {
  return `# System Card: PAISL Local Benchmark Harness

Generated by \`pnpm eval\`. Inspired by system-card disclosure formats; not an official model-provider system card.

## System Description

PAISL is a local-first benchmark harness for personal-agent sovereignty. It includes a deterministic policy simulator, React UI, governance engine, consent and egress probes, submitted-artifact runner, aggregate-risk reports, and public-review packet.

## Capabilities

- Runs ${inputs.scenarios.length} synthetic personal-agent scenarios locally.
- Produces scorecards for usefulness, privacy, autonomy, explainability, latency approximation, minimization, user control, and consented escalation.
- Generates scenario cards, release cards, model-transcript packets, aggregate attack reports, runner-hardening reports, and public validation evidence.

## Safety And Governance Controls

${markdownRows([
  ["Boundary decisions", "local_only, requires_consent, safe_aggregate, blocked"],
  ["Consent receipt probes", inputs.keyCustodyReport.probes.length],
  ["Custody attack probes", inputs.keyCustodyReport.attackProbes.length],
  ["Runner profile probes", inputs.runnerHardeningReport.probes.length],
  ["Submitted artifact Docker probes", inputs.submittedArtifactRunnerReport.dockerProfile.probes.length]
])}

## Residual Risks

- Synthetic scenarios may miss real-world ambiguity.
- Author-defined scoring can encode hidden assumptions.
- Local runner probes are bypassable and do not prove production isolation.
- Fixture keys do not provide production custody or legal non-repudiation.
- Aggregate attack evidence is synthetic and not formal privacy accounting.

## Operator Obligations

- Do not submit real private data in issues, traces, artifacts, or Space demos.
- Do not describe the benchmark as independently validated until external evidence exists.
- Treat accepted criticisms as benchmark evidence, including when they lower scores or invalidate claims.
`;
}

export function renderFiguresAndTables(inputs: PaperPackageInputs): string {
  return `# Paper Figures And Tables

Generated by \`pnpm eval\` from current benchmark artifacts.

## Figure 1: Three-Layer Personal AI Architecture

\`\`\`mermaid
flowchart LR
  L1["Layer 1: local intelligence\\nraw personal context"] --> L2["Layer 2: personal cloud\\nminimized or consented payloads"]
  L2 --> L3["Layer 3: federated / consented collective\\nsafe aggregates or approved negotiation"]
  L1 -. "blocked raw egress" .-> Stop["blocked"]
  L2 -. "requires explicit consent" .-> Gate["consent gate"]
\`\`\`

## Table 1: Scenario Domains

| Domain | Scenario Count |
| --- | ---: |
${scenarioDomainRows(inputs.scenarios).map(([domain, count]) => `| ${domain} | ${count} |`).join("\n")}

## Table 2: Public Corpus Counts

${markdownRows([
  ["Curated scored scenarios", inputs.scenarioGenerationReport.curatedScenarioCount],
  ["Generated public scenarios", inputs.scenarioGenerationReport.generatedScenarioCount],
  ["Total public scenario records", inputs.scenarioGenerationReport.publicScenarioCount],
  ["Private holdout seed count", inputs.scenarioGenerationReport.holdoutCommitment.count]
])}

## Table 3: Canary Harness Agents

| Agent | Runs | Leak Runs | SLR | Usefulness | Consent Correctness |
| --- | ---: | ---: | ---: | ---: | ---: |
${inputs.harnessReport.agents
  .map(
    (agent) =>
      `| ${agent.agentId} | ${agent.runCount} | ${agent.leakRunCount} | ${agent.slr.toFixed(4)} | ${agent.usefulness.toFixed(4)} | ${agent.consentCorrectness.toFixed(4)} |`
  )
  .join("\n")}

## Table 4: Sovereignty-Usefulness Frontier Rows

| Agent | Evidence | Runs | SLR | Sovereignty | Usefulness | Status Counts |
| --- | --- | ---: | ---: | ---: | ---: | --- |
${frontierRows(inputs.sovereigntyFrontierReport)}

## Table 5: External Blockers

| Blocker | Current State |
| --- | --- |
${inputs.externalValidationGateReport.checks
  .map((check) => `| ${check.id} | ${check.result}: ${check.evidence} |`)
  .join("\n")}

## Table 6: Instrument Validation Status

${markdownRows([
  ["Annotation packet cases", inputs.annotationPacketV2CaseCount],
  ["Private annotations loaded", inputs.interRaterReportV2.annotationCount],
  ["Anonymized reviewers", inputs.interRaterReportV2.anonymizedReviewerCount],
  ["Overlapping cases", inputs.interRaterReportV2.overlappingCaseCount],
  ["Status", inputs.interRaterReportV2.status],
  ["Strong threshold", inputs.interRaterReportV2.thresholds.strong],
  ["Tentative threshold", inputs.interRaterReportV2.thresholds.tentative],
  ["Revise threshold", inputs.interRaterReportV2.thresholds.revise]
])}

## Table 7: Data Sensitivity Labels

| Sensitivity | Data Item Count |
| --- | ---: |
${sensitivityRows(inputs.scenarios).map(([sensitivity, count]) => `| ${sensitivity} | ${count} |`).join("\n")}

## Table 8: Baseline Averages

| Baseline | Average Score |
| --- | ---: |
${baselineAverages(inputs.baselineRows).map(([baseline, score]) => `| ${baseline} | ${score} |`).join("\n")}

## Table 9: Evidence Counts

${markdownRows([
  ["Scenarios", inputs.scenarios.length],
  ["Scenario mutations", inputs.scenarioProvenanceReport.mutationCount],
  ["Hidden commitment slots", inputs.scenarioProvenanceReport.hiddenSplitCommitments.length],
  ["Aggregate attack families", inputs.aggregateAttackReport.attackFamilies.length],
  ["Aggregate attack cases", inputs.aggregateAttackReport.attackCount],
  ["Scenario attack cards", inputs.aggregateAttackReport.attackCards.length],
  ["Measurement calibration metrics", inputs.measurementValidityReport.labelCalibrationPacket.metrics.length],
  ["Weight ablation profiles", inputs.measurementValidityReport.metricAblations.profiles.length],
  ["Key custody probes", inputs.keyCustodyReport.probes.length],
  ["Custody attack probes", inputs.keyCustodyReport.attackProbes.length],
  ["Runner escape cases", inputs.runnerHardeningReport.escapeCorpus.length],
  ["Submitted-artifact fixture submissions", inputs.submittedArtifactRunnerReport.submissionCount],
  ["Tiered attack scripts", inputs.attackScriptReport.scriptCount],
  ["Difficulty calibration runs", inputs.difficultyCalibrationReport?.rowCount ?? 0],
  ["Hermetic frontier run records", inputs.sovereigntyFrontierReport.hermeticRunCount],
  ["Live frontier run records", inputs.sovereigntyFrontierReport.liveModelRunCount]
])}

## Table 10: Difficulty Calibration Summary

| Model | Runs | Passes | Pass rate | Mean usefulness |
| --- | ---: | ---: | ---: | ---: |
${difficultyCalibrationRows(inputs.difficultyCalibrationReport)}
`;
}

export function renderPaperPackage(inputs: PaperPackageInputs): PaperPackageArtifacts {
  return {
    paperDraft: renderPaperDraft(inputs),
    benchmarkReleaseCard: renderBenchmarkReleaseCard(inputs),
    systemCard: renderSystemCard(inputs),
    figuresAndTables: renderFiguresAndTables(inputs)
  };
}
