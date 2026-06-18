import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runAgent } from "../agent/runAgent";
import { evaluateRun } from "./scorer";
import { runAdversarialSuite } from "./adversarial";
import {
  buildDeterministicAdversarialPromptExecution,
  renderAdversarialPromptExecutionMarkdown
} from "./adversarialPromptExecution";
import {
  buildAggregateAttackReport,
  renderAggregateAttackMarkdown
} from "./aggregateAttackReport";
import {
  buildAggregateEmpiricalAttackReport,
  renderAggregateEmpiricalAttackMarkdown
} from "./aggregateEmpiricalAttackReport";
import { buildAggregateRiskReport, renderAggregateRiskMarkdown } from "./aggregateRiskReport";
import {
  buildAnnotationAgreementReport,
  loadHumanAnnotations,
  renderAnnotationAgreementMarkdown
} from "./annotationAgreement";
import { writeAnnotationPacketV2 } from "./annotationPacketV2";
import {
  buildBaselineSubmissionReport,
  loadBaselineSubmissions,
  renderBaselineSubmissionMarkdown
} from "./baselineSubmission";
import {
  buildBaselineLeaderboardReport,
  renderBaselineLeaderboardMarkdown
} from "./baselineLeaderboardReport";
import {
  buildBrokerAttestationReport,
  renderBrokerAttestationMarkdown
} from "./brokerAttestationReport";
import {
  buildSandboxedTraceRunnerReport,
  renderSandboxedTraceRunnerMarkdown
} from "./sandboxedTraceRunnerReport";
import {
  buildSubmittedArtifactRunnerReport,
  renderSubmittedArtifactRunnerMarkdown
} from "./submittedArtifactRunnerReport";
import {
  buildArtifactBundleVerificationReport,
  buildArtifactTransparencyLedgerReport,
  renderArtifactBundleVerificationMarkdown,
  renderArtifactTransparencyLedgerMarkdown
} from "./artifactBundle";
import { buildRunnerHardeningReport, renderRunnerHardeningMarkdown } from "./runnerHardeningReport";
import {
  buildMeasurementValidityReport,
  renderLabelCalibrationPacketMarkdown,
  renderMeasurementValidityMarkdown
} from "./measurementValidityReport";
import {
  buildScenarioProvenanceReport,
  renderScenarioProvenanceMarkdown
} from "./scenarioProvenanceReport";
import { compareBaselines } from "./baselines";
import { buildConstructValidityReport, renderConstructValidityMarkdown } from "./constructValidity";
import { buildScenarioCoverageReport, renderScenarioCoverageMarkdown } from "./coverageReport";
import { buildEnforcementReport, renderEnforcementReportMarkdown } from "./enforcementReport";
import {
  buildExternalValidationGateReport,
  renderExternalValidationGateMarkdown
} from "./externalValidationGate";
import {
  buildExternalTraceEvaluationReport,
  loadExternalAgentTraces,
  renderExternalTraceEvaluationMarkdown
} from "./externalTraceEvaluator";
import {
  buildExecutableAggregateAttackReport,
  renderExecutableAggregateAttackMarkdown
} from "./executableAggregateAttackReport";
import { renderHuggingFaceDatasetCard, renderHuggingFaceJsonl } from "./hfDataset";
import { renderPaperPackage } from "./paperPackage";
import { renderReleaseArtifacts } from "./releaseArtifacts";
import {
  buildProcessEgressGuardReport,
  renderProcessEgressGuardMarkdown
} from "./processEgressGuardReport";
import { buildRuntimeManifest, renderRuntimeManifestMarkdown } from "./runtimeManifest";
import {
  buildScorecardStressReport,
  renderScorecardStressMarkdown
} from "./scorecardStressReport";
import { buildStatisticalReport, renderStatisticalReportMarkdown } from "./statistics";
import { writeHarnessArtifacts } from "./harnessReport";
import {
  buildSignedConsentReport,
  renderSignedConsentMarkdown
} from "./signedConsentReport";
import { buildKeyCustodyReport, renderKeyCustodyMarkdown } from "./keyCustodyReport";
import {
  buildStorageBackedEnforcementReport,
  renderStorageBackedEnforcementMarkdown
} from "./storageBackedEnforcementReport";
import { renderScenarioCards } from "./taskCards";
import { buildToolTraceReport, renderToolTraceMarkdown } from "./toolTraceReport";
import {
  buildAggregatePrivacyChallengeReport,
  renderAggregatePrivacyChallengeMarkdown
} from "./aggregatePrivacyChallengeReport";
import { buildAttackScriptReport, renderAttackScriptReportMarkdown } from "./attackScriptReport";
import { loadDifficultyCalibrationReport } from "./difficultyCalibrationReport";
import { writeInterRaterReportV2 } from "./interRaterReportV2";
import {
  curatedScenarios,
  generatedScenarios,
  publicScenarios,
  scenarios
} from "../scenarios/library";
import {
  buildScenarioGenerationReport,
  renderScenarioGenerationMarkdown
} from "./scenarioGenerationReport";
import { writeSovereigntyFrontierArtifacts } from "./sovereigntyFrontierReport";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outputDir = resolve(root, "outputs");
const huggingFaceDir = resolve(root, "huggingface");
const huggingFaceSpaceDir = resolve(huggingFaceDir, "space");
const paperDir = resolve(root, "paper");
const ANNOTATION_SAMPLE_SEED = 20260611;

// Keep `pnpm eval` hermetic. The submitted-artifact and runner-hardening
// reports depend on host Docker availability, so they are generated separately
// (by `pnpm submitted:runner:write` / `pnpm runner:hardening:write`) on a
// Docker-capable host and committed as platform-tagged evidence. Eval reads the
// committed evidence so its outputs are identical on every machine, falling back
// to building only on a fresh checkout that has not committed it yet.
async function readCommittedReport<T>(fileName: string, build: () => Promise<T>): Promise<T> {
  const path = resolve(outputDir, fileName);
  if (existsSync(path)) {
    return JSON.parse(await readFile(path, "utf8")) as T;
  }
  return build();
}

function consentForSampleRun(scenarioId: string): Record<string, boolean> {
  if (scenarioId === "subscription-negotiation") {
    return {
      "negotiation-payload": true
    };
  }

  return {};
}

function renderMarkdownReport(
  results: ReturnType<typeof evaluateRun>[],
  adversarialResults: ReturnType<typeof runAdversarialSuite>,
  baselineRows: ReturnType<typeof compareBaselines>
): string {
  const average = Math.round(
    results.reduce((sum, result) => sum + result.totalScore, 0) / Math.max(1, results.length)
  );
  const weakest = [...results].sort((a, b) => a.totalScore - b.totalScore)[0];
  const adversarialPasses = adversarialResults.filter((result) => result.passed).length;
  const baselineAverages = [
    "sovereign_hybrid",
    "brokered_tool_agent",
    "centralized_cloud",
    "local_only"
  ].map((baselineId) => {
    const rows = baselineRows.filter((row) => row.baselineId === baselineId);
    return {
      baselineId,
      average: rows.reduce((sum, row) => sum + row.totalScore, 0) / rows.length
    };
  });

  const rows = results
    .map((result) => {
      const scenario = scenarios.find((candidate) => candidate.id === result.scenarioId);
      return `| ${scenario?.title ?? result.scenarioId} | ${result.totalScore} | ${result.grade} | ${result.metrics
        .map((metric) => `${metric.label}: ${metric.score}`)
        .join("<br>")} |`;
    })
    .join("\n");

  return `# Sample Evaluation Report

Generated by \`pnpm eval\`.

## Summary

- Scenario count: ${results.length}
- Average score: ${average}/100
- Weakest scenario: ${weakest.scenarioId} at ${weakest.totalScore}/100
- Adversarial containment: ${adversarialPasses}/${adversarialResults.length} cases passed
- Benchmark status: synthetic scaffold, not a validated external benchmark

## Evidence Pack

| Artifact | Path | Role |
| --- | --- | --- |
| Full run log | \`outputs/sample_run_log.json\` | All deterministic runs and scorecards |
| Sample evaluated run | \`outputs/sample_evaluated_run.json\` | One inspectable run with scenario, actions, trace, and scorecard |
| Benchmark card | \`outputs/benchmark_card.md\` | Intended use, non-use, coverage, limitations, research questions |
| Scenario schema | \`schemas/scenario.schema.json\` | Scenario compatibility contract |
| Scoring schema | \`schemas/scoring.schema.json\` | Scorecard compatibility contract |
| Threat-model schema | \`schemas/threat-model.schema.json\` | Assets, actors, threats, controls, residual risk |
| Benchmark-card schema | \`schemas/benchmark-card.schema.json\` | Disclosure format compatibility contract |
| Annotation schema | \`schemas/annotation.schema.json\` | Human review labels for subjective sovereignty judgments |
| Model transcript schema | \`schemas/model-transcript-eval.schema.json\` | Contract for oracle, negative-control, and local-model transcript evaluations |
| Scenario cards | \`outputs/scenario_cards.md\` | Generated task cards for external review and annotation |
| Adversarial prompt pack | \`outputs/adversarial_prompt_pack.md\` | Per-scenario prompt variants for live-model overreach testing |
| Adversarial prompt execution | \`outputs/adversarial_prompt_execution.md\` | Deterministic safe/unsafe execution of every adversarial prompt variant |
| Annotation packet | \`outputs/annotation_packet.md\` | External reviewer packet grounded in transcript evidence |
| Blind annotation packet v2 | \`outputs/annotation_packet_v2.md\` | Blind harness-run sample for external annotators with automated scores and leak findings removed |
| Inter-rater report | \`outputs/inter_rater_report.md\` | Agreement status and external-review blockers |
| Inter-rater report v2 | \`outputs/inter_rater_report_v2.md\` | Private-annotation aggregate with pre-registered alpha thresholds and blocked-external status until labels exist |
| Statistical report | \`outputs/statistical_report.md\` | Bootstrap interval, score distribution, and metric-weight sensitivity |
| Egress enforcement report | \`outputs/enforcement_report.md\` | Consent receipt, revocation, retention, and egress guard probes |
| Storage-backed runtime enforcement | \`outputs/runtime_enforcement_report.md\` | File-backed consent ledger and fetch-mediated egress audit probes |
| Tool-agent trace report | \`outputs/tool_trace_report.md\` | Executable in-process tool calls with consent, aggregate, and unsafe-raw traces |
| Aggregate risk report | \`outputs/aggregate_risk_report.md\` | Synthetic linkability and reconstruction-risk stress test for aggregate release |
| Signed consent report | \`outputs/signed_consent_report.md\` | Keyed receipt-integrity probes for valid, tampered, revoked, and scope-mismatched consent |
| Key custody lifecycle report | \`outputs/key_custody_report.md\` | Deterministic rotation, retirement, revocation, historical verification, and tamper-control probes |
| Container network confinement probe | \`outputs/container_network_confinement_probe.md\` | Docker positive-control and network-none denial evidence, generated separately from \`pnpm eval\` |
| Scenario coverage report | \`outputs/scenario_coverage_report.md\` | Domain, sensitivity, layer, adversarial, and public split coverage |
| Construct validity report | \`outputs/construct_validity_report.md\` | Baseline separability, adversarial calibration, enforcement, and remaining label blockers |
| Runtime manifest | \`outputs/runtime_manifest.md\` | Supported runtime, model-evidence provenance, and non-claims |
| Label calibration packet | \`outputs/label_calibration_packet.md\` | Maps each score metric to observable evidence, reviewer questions, failure signals, and adjudication templates |
| Measurement validity report | \`outputs/measurement_validity_report.md\` | Runs synthetic agreement sanity checks, metric-weight ablations, and scenario difficulty/ambiguity coverage |
| Scenario provenance report | \`outputs/scenario_provenance_report.md\` | Records scenario authorship, provenance, split policy, hidden commitment slots, and mutation coverage |
| Scorecard stress report | \`outputs/scorecard_stress_report.md\` | Negative-control separation and ceiling-effect checks for author-defined scoring |
| Process egress guard report | \`outputs/process_egress_guard_report.md\` | Child-process preload enforcement for Fetch, HTTP, HTTPS, TCP, and TLS egress attempts |
| Aggregate attack report | \`outputs/aggregate_attack_report.md\` | Synthetic attack-shaped pressure on aggregate-release decisions |
| Synthetic cohort attack report | \`outputs/aggregate_empirical_attack_report.md\` | Synthetic quasi-identifier uniqueness experiment for aggregate candidates |
| Executable aggregate attack report | \`outputs/executable_aggregate_attack_report.md\` | Deterministic linkage, differencing, and small-cell attacks against aggregate fixtures |
| Aggregate privacy challenge | \`outputs/aggregate_privacy_challenge_report.md\` | Semi-realistic synthetic microdata target-inference challenge for naive versus controlled aggregates |
| Annotation agreement report | \`outputs/annotation_agreement_report.md\` | Aggregates human annotation files and preserves independent-review blockers |
| Baseline submission report | \`outputs/baseline_submission_report.md\` | Tracks external baseline submissions, coverage, and missing production-agent evidence |
| Baseline leaderboard report | \`outputs/baseline_leaderboard_report.md\` | Lists runnable local adapters, submitted-artifact fixtures, and strong-baseline gates |
| External trace evaluation report | \`outputs/external_trace_evaluation_report.md\` | Normalizes submitted agent traces into boundary, consent, and aggregate-control findings |
| Broker attestation report | \`outputs/broker_attestation_report.md\` | Replays submitted traces through a deterministic broker and signs execution/block attestations |
| Sandboxed trace runner report | \`outputs/sandboxed_trace_runner_report.md\` | Executes broker-approved trace actions in a guarded child process and records escape-attempt denials |
| Submitted artifact runner report | \`outputs/submitted_artifact_runner_report.md\` | Executes fixture submitted artifacts, binds source digests to receipts, and probes a hardened Docker profile |
| Artifact bundle verification report | \`outputs/artifact_bundle_verification_report.md\` | Verifies submitted bundle manifests, pinned runtime metadata, source digests, expected outputs, claim boundaries, and undeclared writes |
| Artifact transparency ledger report | \`outputs/artifact_transparency_ledger_report.md\` | Chains submitted-artifact receipts to bundle manifests and runs a deterministic tamper probe |
| Runner hardening report | \`outputs/runner_hardening_report.md\` | Defines the Docker profile contract and executes the runner escape corpus for package install, child process, filesystem, environment, DNS, IPC, and resource controls |
| External validation gate | \`outputs/external_validation_gate.md\` | Combines annotation, baseline, and aggregate-attack blockers into one release gate |
| Sovereignty-usefulness frontier | \`outputs/sovereignty_frontier_report.md\` | Plots execution-level SLR versus objective usefulness for available harness run records |
| Difficulty calibration report | \`outputs/difficulty_calibration_report.md\` | Optional platform-tagged local-model pass-rate and saturation-guard evidence |
| Hugging Face package | \`huggingface/README.md\` | Dataset-card draft and JSONL scenario preview |
| Release packet | \`outputs/v0.18_release_packet.md\` | 1.0.0-rc.0 public release evidence, v0.18 evidence-lineage note, honest claims, and blockers |
| Model transcript eval | \`outputs/model_transcript_eval_multimodel.md\` | Optional local-model plan evaluation against the policy oracle |

## Baseline Discrimination

| Baseline | Average Score | Interpretation |
| --- | ---: | --- |
${baselineAverages
  .map((row) => {
    const interpretation =
      row.baselineId === "sovereign_hybrid"
        ? "Reference policy-aware personal-agent scaffold"
        : row.baselineId === "brokered_tool_agent"
          ? "Tool-agent baseline with consent receipts and egress mediation"
        : row.baselineId === "centralized_cloud"
          ? "Negative control: convenience-first raw cloud disclosure"
          : "Negative control: privacy-preserving but over-restrictive local-only behavior";
    return `| ${row.baselineId} | ${row.average.toFixed(1)} | ${interpretation} |`;
  })
  .join("\n")}

## Scenario Scores

| Scenario | Score | Grade | Metric Breakdown |
| --- | ---: | --- | --- |
${rows}

## Known Failure Cases

${results
  .flatMap((result) => result.failureCases.slice(0, 2).map((failure) => `- ${result.scenarioId}: ${failure}`))
  .join("\n")}

## Interpretation

These scores are useful for regression testing and design review, not for claiming model superiority. The harness is intentionally deterministic so reviewers can inspect exactly how a data-boundary decision changed a score.

The benchmark object is the evaluated run, not just the final text response. A valid run must preserve the scenario, consent state, action trace, governance decisions, scorecard, and failure cases.

## Adversarial Containment Checks

| Case | Scenario | Unsafe Ask | Observed | Result |
| --- | --- | --- | --- | --- |
${adversarialResults
  .map(
    (result) =>
      `| ${result.id} | ${result.scenarioId} | ${result.unsafeAsk} | ${result.observedDecision} | ${
        result.passed ? "pass" : "fail"
      } |`
  )
  .join("\n")}
`;
}

async function main(): Promise<void> {
  await mkdir(outputDir, { recursive: true });
  await mkdir(huggingFaceDir, { recursive: true });
  await mkdir(huggingFaceSpaceDir, { recursive: true });
  await mkdir(paperDir, { recursive: true });

  const runs = scenarios.map((scenario) => runAgent(scenario, consentForSampleRun(scenario.id)));
  const results = runs.map((run) => evaluateRun(run));
  const adversarialResults = runAdversarialSuite();
  const baselineRows = compareBaselines();
  const statisticalReport = buildStatisticalReport(results);
  const enforcementReport = buildEnforcementReport(scenarios);
  const toolTraceReport = buildToolTraceReport(scenarios);
  const aggregateRiskReport = buildAggregateRiskReport(scenarios);
  const aggregateAttackReport = buildAggregateAttackReport(aggregateRiskReport);
  const aggregateEmpiricalAttackReport = buildAggregateEmpiricalAttackReport(aggregateRiskReport);
  const executableAggregateAttackReport = buildExecutableAggregateAttackReport(aggregateRiskReport);
  const aggregatePrivacyChallengeReport = buildAggregatePrivacyChallengeReport(aggregateRiskReport);
  const signedConsentReport = buildSignedConsentReport(scenarios);
  const keyCustodyReport = buildKeyCustodyReport(scenarios);
  const annotationInputs = await loadHumanAnnotations(root);
  const annotationAgreementReport = buildAnnotationAgreementReport(
    annotationInputs.annotations,
    annotationInputs.sourcePaths
  );
  const baselineInputs = await loadBaselineSubmissions(root);
  const baselineSubmissionReport = buildBaselineSubmissionReport(
    baselineInputs.submissions,
    baselineInputs.sourcePaths
  );
  const externalTraceInputs = await loadExternalAgentTraces(root);
  const externalTraceEvaluationReport = buildExternalTraceEvaluationReport(
    externalTraceInputs.traces,
    externalTraceInputs.sourcePaths
  );
  const brokerAttestationReport = buildBrokerAttestationReport(
    externalTraceInputs.traces,
    externalTraceInputs.sourcePaths
  );
  const sandboxedTraceRunnerReport = await buildSandboxedTraceRunnerReport(
    externalTraceInputs.traces,
    externalTraceInputs.sourcePaths
  );
  const submittedArtifactRunnerReport = await readCommittedReport(
    "submitted_artifact_runner_report.json",
    () => buildSubmittedArtifactRunnerReport(root)
  );
  const baselineLeaderboardReport = buildBaselineLeaderboardReport(
    baselineRows,
    baselineSubmissionReport,
    submittedArtifactRunnerReport,
    scenarios.length
  );
  const artifactBundleVerificationReport = await buildArtifactBundleVerificationReport(root);
  const artifactTransparencyLedgerReport = buildArtifactTransparencyLedgerReport(
    artifactBundleVerificationReport,
    submittedArtifactRunnerReport
  );
  const runnerHardeningReport = await readCommittedReport(
    "runner_hardening_report.json",
    () => buildRunnerHardeningReport(root)
  );
  const externalValidationGateReport = buildExternalValidationGateReport(
    annotationAgreementReport,
    baselineSubmissionReport,
    aggregateEmpiricalAttackReport
  );
  const storageBackedEnforcementReport = await buildStorageBackedEnforcementReport(root, scenarios);
  const processEgressGuardReport = await buildProcessEgressGuardReport();
  const scenarioCoverageReport = buildScenarioCoverageReport(scenarios);
  const runtimeManifest = buildRuntimeManifest(scenarios);
  const measurementValidityReport = buildMeasurementValidityReport(results, scenarios);
  const scenarioProvenanceReport = buildScenarioProvenanceReport(scenarios);
  const scorecardStressReport = buildScorecardStressReport(results, baselineRows);
  const adversarialPromptExecution = buildDeterministicAdversarialPromptExecution(scenarios);
  const harnessReport = await writeHarnessArtifacts(root, scenarios);
  const annotationPacketV2 = await writeAnnotationPacketV2(root, ANNOTATION_SAMPLE_SEED);
  const interRaterReportV2 = await writeInterRaterReportV2(root, ANNOTATION_SAMPLE_SEED);
  const attackScriptReport = await buildAttackScriptReport(scenarios);
  const difficultyCalibrationReport = await loadDifficultyCalibrationReport(root);
  const sovereigntyFrontierReport = await writeSovereigntyFrontierArtifacts(root);
  const scenarioGenerationReport = await buildScenarioGenerationReport(root, {
    curatedScenarios,
    generatedScenarios,
    publicScenarios
  });
  const constructValidityReport = buildConstructValidityReport(
    baselineRows,
    enforcementReport,
    toolTraceReport,
    aggregateRiskReport,
    adversarialPromptExecution,
    statisticalReport
  );
  const paperPackage = renderPaperPackage({
    scenarios,
    results,
    baselineRows,
    statisticalReport,
    measurementValidityReport,
    scenarioProvenanceReport,
    aggregateAttackReport,
    baselineLeaderboardReport,
    keyCustodyReport,
    runnerHardeningReport,
    submittedArtifactRunnerReport,
    externalValidationGateReport,
    harnessReport,
    attackScriptReport,
    difficultyCalibrationReport,
    sovereigntyFrontierReport,
    interRaterReportV2,
    annotationPacketV2CaseCount: annotationPacketV2.cases.length,
    scenarioGenerationReport
  });

  await writeFile(
    resolve(outputDir, "sample_run_log.json"),
    `${JSON.stringify(
      {
        generatedAt: new Date("2026-05-22T00:00:00.000Z").toISOString(),
        benchmark: "personal-ai-sovereignty-lab-synthetic-v0",
        runs,
        results,
        adversarialResults,
        baselineRows,
        statisticalReport,
        enforcementReport,
        storageBackedEnforcementReport,
        toolTraceReport,
        aggregateRiskReport,
        aggregateAttackReport,
        aggregateEmpiricalAttackReport,
        executableAggregateAttackReport,
        aggregatePrivacyChallengeReport,
        signedConsentReport,
        keyCustodyReport,
        annotationAgreementReport,
        baselineSubmissionReport,
        baselineLeaderboardReport,
        externalTraceEvaluationReport,
        brokerAttestationReport,
        sandboxedTraceRunnerReport,
        submittedArtifactRunnerReport,
        artifactBundleVerificationReport,
        artifactTransparencyLedgerReport,
        runnerHardeningReport,
        externalValidationGateReport,
        processEgressGuardReport,
        scenarioCoverageReport,
        constructValidityReport,
        runtimeManifest,
        measurementValidityReport,
        scenarioProvenanceReport,
        scorecardStressReport,
        adversarialPromptExecution,
        harnessReport,
        annotationPacketV2,
        interRaterReportV2,
        attackScriptReport,
        difficultyCalibrationReport,
        sovereigntyFrontierReport,
        scenarioGenerationReport,
        holdoutCommitment: scenarioGenerationReport.holdoutCommitment
      },
      null,
      2
    )}\n`
  );

  await writeFile(
    resolve(outputDir, "sample_eval_report.md"),
    renderMarkdownReport(results, adversarialResults, baselineRows)
  );

  await writeFile(
    resolve(outputDir, "baseline_comparison.json"),
    `${JSON.stringify(
      {
        benchmark: "personal-ai-sovereignty-lab-synthetic-v0",
        baselineRows
      },
      null,
      2
    )}\n`
  );

  await writeFile(
    resolve(outputDir, "sample_evaluated_run.json"),
    `${JSON.stringify(
      {
        benchmark: "personal-ai-sovereignty-lab-synthetic-v0",
        run: runs[4],
        evaluation: results[4],
        adversarialResults: adversarialResults.filter(
          (result) => result.scenarioId === runs[4].scenario.id
        )
      },
      null,
      2
    )}\n`
  );

  await writeFile(resolve(outputDir, "scenario_cards.md"), renderScenarioCards(scenarios));

  await writeFile(
    resolve(outputDir, "statistical_report.json"),
    `${JSON.stringify(statisticalReport, null, 2)}\n`
  );
  await writeFile(
    resolve(outputDir, "statistical_report.md"),
    renderStatisticalReportMarkdown(statisticalReport)
  );
  await writeFile(
    resolve(outputDir, "enforcement_report.json"),
    `${JSON.stringify(enforcementReport, null, 2)}\n`
  );
  await writeFile(
    resolve(outputDir, "enforcement_report.md"),
    renderEnforcementReportMarkdown(enforcementReport)
  );
  await writeFile(
    resolve(outputDir, "runtime_enforcement_report.json"),
    `${JSON.stringify(storageBackedEnforcementReport, null, 2)}\n`
  );
  await writeFile(
    resolve(outputDir, "runtime_enforcement_report.md"),
    renderStorageBackedEnforcementMarkdown(storageBackedEnforcementReport)
  );
  await writeFile(
    resolve(outputDir, "signed_consent_report.json"),
    `${JSON.stringify(signedConsentReport, null, 2)}\n`
  );
  await writeFile(
    resolve(outputDir, "signed_consent_report.md"),
    renderSignedConsentMarkdown(signedConsentReport)
  );
  await writeFile(
    resolve(outputDir, "key_custody_report.json"),
    `${JSON.stringify(keyCustodyReport, null, 2)}\n`
  );
  await writeFile(
    resolve(outputDir, "key_custody_report.md"),
    renderKeyCustodyMarkdown(keyCustodyReport)
  );
  await writeFile(
    resolve(outputDir, "process_egress_guard_report.json"),
    `${JSON.stringify(processEgressGuardReport, null, 2)}\n`
  );
  await writeFile(
    resolve(outputDir, "process_egress_guard_report.md"),
    renderProcessEgressGuardMarkdown(processEgressGuardReport)
  );
  await writeFile(
    resolve(outputDir, "tool_trace_report.json"),
    `${JSON.stringify(toolTraceReport, null, 2)}\n`
  );
  await writeFile(
    resolve(outputDir, "tool_trace_report.md"),
    renderToolTraceMarkdown(toolTraceReport)
  );
  await writeFile(
    resolve(outputDir, "aggregate_risk_report.json"),
    `${JSON.stringify(aggregateRiskReport, null, 2)}\n`
  );
  await writeFile(
    resolve(outputDir, "aggregate_risk_report.md"),
    renderAggregateRiskMarkdown(aggregateRiskReport)
  );
  await writeFile(
    resolve(outputDir, "aggregate_attack_report.json"),
    `${JSON.stringify(aggregateAttackReport, null, 2)}\n`
  );
  await writeFile(
    resolve(outputDir, "aggregate_attack_report.md"),
    renderAggregateAttackMarkdown(aggregateAttackReport)
  );
  await writeFile(
    resolve(outputDir, "aggregate_empirical_attack_report.json"),
    `${JSON.stringify(aggregateEmpiricalAttackReport, null, 2)}\n`
  );
  await writeFile(
    resolve(outputDir, "aggregate_empirical_attack_report.md"),
    renderAggregateEmpiricalAttackMarkdown(aggregateEmpiricalAttackReport)
  );
  await writeFile(
    resolve(outputDir, "executable_aggregate_attack_report.json"),
    `${JSON.stringify(executableAggregateAttackReport, null, 2)}\n`
  );
  await writeFile(
    resolve(outputDir, "executable_aggregate_attack_report.md"),
    renderExecutableAggregateAttackMarkdown(executableAggregateAttackReport)
  );
  await writeFile(
    resolve(outputDir, "aggregate_privacy_challenge_report.json"),
    `${JSON.stringify(aggregatePrivacyChallengeReport, null, 2)}\n`
  );
  await writeFile(
    resolve(outputDir, "aggregate_privacy_challenge_report.md"),
    renderAggregatePrivacyChallengeMarkdown(aggregatePrivacyChallengeReport)
  );
  await writeFile(
    resolve(outputDir, "annotation_agreement_report.json"),
    `${JSON.stringify(annotationAgreementReport, null, 2)}\n`
  );
  await writeFile(
    resolve(outputDir, "annotation_agreement_report.md"),
    renderAnnotationAgreementMarkdown(annotationAgreementReport)
  );
  await writeFile(
    resolve(outputDir, "baseline_submission_report.json"),
    `${JSON.stringify(baselineSubmissionReport, null, 2)}\n`
  );
  await writeFile(
    resolve(outputDir, "baseline_submission_report.md"),
    renderBaselineSubmissionMarkdown(baselineSubmissionReport)
  );
  await writeFile(
    resolve(outputDir, "baseline_leaderboard_report.json"),
    `${JSON.stringify(baselineLeaderboardReport, null, 2)}\n`
  );
  await writeFile(
    resolve(outputDir, "baseline_leaderboard_report.md"),
    renderBaselineLeaderboardMarkdown(baselineLeaderboardReport)
  );
  await writeFile(
    resolve(outputDir, "external_trace_evaluation_report.json"),
    `${JSON.stringify(externalTraceEvaluationReport, null, 2)}\n`
  );
  await writeFile(
    resolve(outputDir, "external_trace_evaluation_report.md"),
    renderExternalTraceEvaluationMarkdown(externalTraceEvaluationReport)
  );
  await writeFile(
    resolve(outputDir, "broker_attestation_report.json"),
    `${JSON.stringify(brokerAttestationReport, null, 2)}\n`
  );
  await writeFile(
    resolve(outputDir, "broker_attestation_report.md"),
    renderBrokerAttestationMarkdown(brokerAttestationReport)
  );
  await writeFile(
    resolve(outputDir, "sandboxed_trace_runner_report.json"),
    `${JSON.stringify(sandboxedTraceRunnerReport, null, 2)}\n`
  );
  await writeFile(
    resolve(outputDir, "sandboxed_trace_runner_report.md"),
    renderSandboxedTraceRunnerMarkdown(sandboxedTraceRunnerReport)
  );
  // submitted_artifact_runner_report.{json,md} are env-dependent (Docker) and
  // are written by `pnpm submitted:runner:write`, not by the hermetic eval.
  await writeFile(
    resolve(outputDir, "artifact_bundle_verification_report.json"),
    `${JSON.stringify(artifactBundleVerificationReport, null, 2)}\n`
  );
  await writeFile(
    resolve(outputDir, "artifact_bundle_verification_report.md"),
    renderArtifactBundleVerificationMarkdown(artifactBundleVerificationReport)
  );
  await writeFile(
    resolve(outputDir, "artifact_transparency_ledger_report.json"),
    `${JSON.stringify(artifactTransparencyLedgerReport, null, 2)}\n`
  );
  await writeFile(
    resolve(outputDir, "artifact_transparency_ledger_report.md"),
    renderArtifactTransparencyLedgerMarkdown(artifactTransparencyLedgerReport)
  );
  // runner_hardening_report.{json,md} are env-dependent (Docker) and are
  // written by `pnpm runner:hardening:write`, not by the hermetic eval.
  await writeFile(
    resolve(outputDir, "external_validation_gate.json"),
    `${JSON.stringify(externalValidationGateReport, null, 2)}\n`
  );
  await writeFile(
    resolve(outputDir, "external_validation_gate.md"),
    renderExternalValidationGateMarkdown(externalValidationGateReport)
  );
  await writeFile(
    resolve(outputDir, "scenario_coverage_report.json"),
    `${JSON.stringify(scenarioCoverageReport, null, 2)}\n`
  );
  await writeFile(
    resolve(outputDir, "scenario_coverage_report.md"),
    renderScenarioCoverageMarkdown(scenarioCoverageReport)
  );
  await writeFile(
    resolve(outputDir, "construct_validity_report.json"),
    `${JSON.stringify(constructValidityReport, null, 2)}\n`
  );
  await writeFile(
    resolve(outputDir, "construct_validity_report.md"),
    renderConstructValidityMarkdown(constructValidityReport)
  );
  await writeFile(
    resolve(outputDir, "runtime_manifest.json"),
    `${JSON.stringify(runtimeManifest, null, 2)}\n`
  );
  await writeFile(
    resolve(outputDir, "runtime_manifest.md"),
    renderRuntimeManifestMarkdown(runtimeManifest)
  );
  await writeFile(
    resolve(outputDir, "measurement_validity_report.json"),
    `${JSON.stringify(measurementValidityReport, null, 2)}\n`
  );
  await writeFile(
    resolve(outputDir, "measurement_validity_report.md"),
    renderMeasurementValidityMarkdown(measurementValidityReport)
  );
  await writeFile(
    resolve(outputDir, "label_calibration_packet.json"),
    `${JSON.stringify(measurementValidityReport.labelCalibrationPacket, null, 2)}\n`
  );
  await writeFile(
    resolve(outputDir, "label_calibration_packet.md"),
    renderLabelCalibrationPacketMarkdown(measurementValidityReport)
  );
  await writeFile(
    resolve(outputDir, "scenario_provenance_report.json"),
    `${JSON.stringify(scenarioProvenanceReport, null, 2)}\n`
  );
  await writeFile(
    resolve(outputDir, "scenario_provenance_report.md"),
    renderScenarioProvenanceMarkdown(scenarioProvenanceReport)
  );
  await writeFile(
    resolve(outputDir, "scorecard_stress_report.json"),
    `${JSON.stringify(scorecardStressReport, null, 2)}\n`
  );
  await writeFile(
    resolve(outputDir, "scorecard_stress_report.md"),
    renderScorecardStressMarkdown(scorecardStressReport)
  );
  await writeFile(resolve(huggingFaceDir, "README.md"), renderHuggingFaceDatasetCard(publicScenarios));
  await writeFile(resolve(huggingFaceDir, "dataset_preview.jsonl"), renderHuggingFaceJsonl(publicScenarios));
  await writeFile(
    resolve(huggingFaceSpaceDir, "dataset_preview.jsonl"),
    renderHuggingFaceJsonl(publicScenarios)
  );
  await writeFile(
    resolve(huggingFaceSpaceDir, "sovereignty_frontier_report.json"),
    `${JSON.stringify(sovereigntyFrontierReport, null, 2)}\n`
  );
  await writeFile(
    resolve(huggingFaceSpaceDir, "sovereignty_frontier.svg"),
    await readFile(resolve(outputDir, "figures/sovereignty_frontier.svg"), "utf8")
  );
  await writeFile(
    resolve(outputDir, "adversarial_prompt_execution.json"),
    `${JSON.stringify(adversarialPromptExecution, null, 2)}\n`
  );
  await writeFile(
    resolve(outputDir, "adversarial_prompt_execution.md"),
    renderAdversarialPromptExecutionMarkdown(adversarialPromptExecution)
  );
  await writeFile(
    resolve(outputDir, "attack_script_report.json"),
    `${JSON.stringify(attackScriptReport, null, 2)}\n`
  );
  await writeFile(
    resolve(outputDir, "attack_script_report.md"),
    renderAttackScriptReportMarkdown(attackScriptReport)
  );
  await writeFile(
    resolve(outputDir, "holdout_commitment.json"),
    `${JSON.stringify(scenarioGenerationReport.holdoutCommitment, null, 2)}\n`
  );
  await writeFile(
    resolve(outputDir, "scenario_generation_report.json"),
    `${JSON.stringify(scenarioGenerationReport, null, 2)}\n`
  );
  await writeFile(
    resolve(outputDir, "scenario_generation_report.md"),
    renderScenarioGenerationMarkdown(scenarioGenerationReport)
  );

  const releaseArtifacts = renderReleaseArtifacts(root, scenarios);
  await Promise.all(
    Object.entries(releaseArtifacts).map(([fileName, contents]) =>
      writeFile(resolve(outputDir, fileName), contents)
    )
  );

  await writeFile(
    resolve(paperDir, "personal_ai_sovereignty_benchmark.md"),
    paperPackage.paperDraft
  );
  await writeFile(resolve(outputDir, "benchmark_release_card.md"), paperPackage.benchmarkReleaseCard);
  await writeFile(resolve(outputDir, "system_card.md"), paperPackage.systemCard);
  await writeFile(resolve(outputDir, "figures_and_tables.md"), paperPackage.figuresAndTables);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
