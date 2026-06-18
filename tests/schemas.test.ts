import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import { runAgent } from "../src/agent/runAgent";
import { evaluateRun } from "../src/evals/scorer";
import { publicScenarios, scenarios } from "../src/scenarios/library";

const root = resolve(__dirname, "..");

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(root, path), "utf8")) as T;
}

function readFirstJsonl<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(root, path), "utf8").trim().split("\n")[0]) as T;
}

describe("benchmark schemas", () => {
  const ajv = new Ajv2020({ allErrors: true });
  addFormats(ajv);

  it("validates every built-in scenario against the scenario schema", () => {
    const validate = ajv.compile(readJson("schemas/scenario.schema.json"));

    for (const scenario of publicScenarios) {
      expect(validate(scenario), JSON.stringify(validate.errors, null, 2)).toBe(true);
    }
  });

  it("validates generated scorecards against the scoring schema", () => {
    const validate = ajv.compile(readJson("schemas/scoring.schema.json"));

    for (const scenario of scenarios) {
      const scorecard = evaluateRun(runAgent(scenario));
      expect(validate(scorecard), JSON.stringify(validate.errors, null, 2)).toBe(true);
    }
  });

  it("validates the example threat model and benchmark card", () => {
    const threatValidate = ajv.compile(readJson("schemas/threat-model.schema.json"));
    const cardValidate = ajv.compile(readJson("schemas/benchmark-card.schema.json"));
    const annotationValidate = ajv.compile(readJson("schemas/annotation.schema.json"));
    const annotationV2Validate = ajv.compile(readJson("schemas/annotation-v2.schema.json"));
    const baselineSubmissionValidate = ajv.compile(
      readJson("schemas/baseline-submission.schema.json")
    );
    const externalAgentTraceValidate = ajv.compile(readJson("schemas/external-agent-trace.schema.json"));
    const artifactBundleValidate = ajv.compile(readJson("schemas/artifact-bundle.schema.json"));

    expect(
      threatValidate(readJson("examples/threat_model.example.json")),
      JSON.stringify(threatValidate.errors, null, 2)
    ).toBe(true);
    expect(
      cardValidate(readJson("examples/benchmark_card.example.json")),
      JSON.stringify(cardValidate.errors, null, 2)
    ).toBe(true);
    expect(
      annotationValidate(readJson("examples/human_annotation.example.json")),
      JSON.stringify(annotationValidate.errors, null, 2)
    ).toBe(true);
    expect(
      annotationV2Validate(readJson("examples/human_annotation_v2.example.json")),
      JSON.stringify(annotationV2Validate.errors, null, 2)
    ).toBe(true);
    expect(
      baselineSubmissionValidate(readJson("examples/baseline_submission.example.json")),
      JSON.stringify(baselineSubmissionValidate.errors, null, 2)
    ).toBe(true);
    expect(
      externalAgentTraceValidate(readJson("examples/external_agent_trace.example.json")),
      JSON.stringify(externalAgentTraceValidate.errors, null, 2)
    ).toBe(true);
    expect(
      externalAgentTraceValidate(readJson("examples/external_traces/negative_control_raw_upload.json")),
      JSON.stringify(externalAgentTraceValidate.errors, null, 2)
    ).toBe(true);
    expect(
      artifactBundleValidate(readJson("examples/artifact_bundles/safe-minimized-agent/bundle.json")),
      JSON.stringify(artifactBundleValidate.errors, null, 2)
    ).toBe(true);
    expect(
      artifactBundleValidate(readJson("examples/artifact_bundles/raw-upload-agent/bundle.json")),
      JSON.stringify(artifactBundleValidate.errors, null, 2)
    ).toBe(true);
    expect(
      artifactBundleValidate(readJson("examples/artifact_bundles/malformed-unexpected-write-agent/bundle.json"))
    ).toBe(false);
  });

  it("validates the generated model transcript evaluation", () => {
    const validate = ajv.compile(readJson("schemas/model-transcript-eval.schema.json"));

    expect(
      validate(readJson("outputs/model_transcript_eval_multimodel.json")),
      JSON.stringify(validate.errors, null, 2)
    ).toBe(true);
  });

  it("validates generated release artifacts", () => {
    const promptPackValidate = ajv.compile(readJson("schemas/adversarial-prompt-pack.schema.json"));
    const attackScriptReportValidate = ajv.compile(readJson("schemas/attack-script-report.schema.json"));
    const promptExecutionValidate = ajv.compile(
      readJson("schemas/adversarial-prompt-execution.schema.json")
    );
    const annotationPacketValidate = ajv.compile(readJson("schemas/annotation-packet.schema.json"));
    const annotationPacketV2Validate = ajv.compile(
      readJson("schemas/annotation-packet-v2.schema.json")
    );
    const interRaterValidate = ajv.compile(readJson("schemas/inter-rater-report.schema.json"));
    const interRaterV2Validate = ajv.compile(readJson("schemas/inter-rater-report-v2.schema.json"));
    const releaseChecklistValidate = ajv.compile(readJson("schemas/release-checklist.schema.json"));
    const statisticalReportValidate = ajv.compile(readJson("schemas/statistical-report.schema.json"));
    const runtimeManifestValidate = ajv.compile(readJson("schemas/runtime-manifest.schema.json"));
    const enforcementReportValidate = ajv.compile(readJson("schemas/enforcement-report.schema.json"));
    const runtimeEnforcementReportValidate = ajv.compile(
      readJson("schemas/runtime-enforcement-report.schema.json")
    );
    const signedConsentReportValidate = ajv.compile(
      readJson("schemas/signed-consent-report.schema.json")
    );
    const keyCustodyReportValidate = ajv.compile(
      readJson("schemas/key-custody-report.schema.json")
    );
    const processEgressGuardReportValidate = ajv.compile(
      readJson("schemas/process-egress-guard-report.schema.json")
    );
    const containerNetworkConfinementReportValidate = ajv.compile(
      readJson("schemas/container-network-confinement-report.schema.json")
    );
    const toolTraceReportValidate = ajv.compile(readJson("schemas/tool-trace-report.schema.json"));
    const aggregateRiskReportValidate = ajv.compile(
      readJson("schemas/aggregate-risk-report.schema.json")
    );
    const aggregateAttackReportValidate = ajv.compile(
      readJson("schemas/aggregate-attack-report.schema.json")
    );
    const aggregateEmpiricalAttackReportValidate = ajv.compile(
      readJson("schemas/aggregate-empirical-attack-report.schema.json")
    );
    const executableAggregateAttackReportValidate = ajv.compile(
      readJson("schemas/executable-aggregate-attack-report.schema.json")
    );
    const aggregatePrivacyChallengeReportValidate = ajv.compile(
      readJson("schemas/aggregate-privacy-challenge-report.schema.json")
    );
    const annotationAgreementReportValidate = ajv.compile(
      readJson("schemas/annotation-agreement-report.schema.json")
    );
    const baselineSubmissionReportValidate = ajv.compile(
      readJson("schemas/baseline-submission-report.schema.json")
    );
    const baselineLeaderboardReportValidate = ajv.compile(
      readJson("schemas/baseline-leaderboard-report.schema.json")
    );
    const externalTraceEvaluationReportValidate = ajv.compile(
      readJson("schemas/external-trace-evaluation-report.schema.json")
    );
    const brokerAttestationReportValidate = ajv.compile(
      readJson("schemas/broker-attestation-report.schema.json")
    );
    const sandboxedTraceRunnerReportValidate = ajv.compile(
      readJson("schemas/sandboxed-trace-runner-report.schema.json")
    );
    const submittedArtifactRunnerReportValidate = ajv.compile(
      readJson("schemas/submitted-artifact-runner-report.schema.json")
    );
    const artifactBundleVerificationReportValidate = ajv.compile(
      readJson("schemas/artifact-bundle-verification-report.schema.json")
    );
    const artifactTransparencyLedgerReportValidate = ajv.compile(
      readJson("schemas/artifact-transparency-ledger-report.schema.json")
    );
    const runnerHardeningReportValidate = ajv.compile(
      readJson("schemas/runner-hardening-report.schema.json")
    );
    const measurementValidityReportValidate = ajv.compile(
      readJson("schemas/measurement-validity-report.schema.json")
    );
    const labelCalibrationPacketValidate = ajv.compile(
      readJson("schemas/label-calibration-packet.schema.json")
    );
    const scenarioProvenanceReportValidate = ajv.compile(
      readJson("schemas/scenario-provenance-report.schema.json")
    );
    const externalValidationGateValidate = ajv.compile(
      readJson("schemas/external-validation-gate.schema.json")
    );
    const scenarioCoverageValidate = ajv.compile(
      readJson("schemas/scenario-coverage-report.schema.json")
    );
    const constructValidityValidate = ajv.compile(
      readJson("schemas/construct-validity-report.schema.json")
    );
    const scorecardStressReportValidate = ajv.compile(
      readJson("schemas/scorecard-stress-report.schema.json")
    );
    const artifactManifestValidate = ajv.compile(readJson("schemas/artifact-manifest.schema.json"));
    const publicValidationValidate = ajv.compile(
      readJson("schemas/public-validation-report.schema.json")
    );
    const harnessReportValidate = ajv.compile(readJson("schemas/harness-report.schema.json"));
    const harnessRunValidate = ajv.compile(readJson("schemas/harness-run.schema.json"));
    const holdoutCommitmentValidate = ajv.compile(
      readJson("schemas/holdout-commitment.schema.json")
    );
    const scenarioGenerationReportValidate = ajv.compile(
      readJson("schemas/scenario-generation-report.schema.json")
    );
    const sovereigntyFrontierReportValidate = ajv.compile(
      readJson("schemas/sovereignty-frontier-report.schema.json")
    );
    const difficultyCalibrationReportValidate = ajv.compile(
      readJson("schemas/difficulty-calibration-report.schema.json")
    );

    expect(
      promptPackValidate(readJson("outputs/adversarial_prompt_pack.json")),
      JSON.stringify(promptPackValidate.errors, null, 2)
    ).toBe(true);
    expect(
      attackScriptReportValidate(readJson("outputs/attack_script_report.json")),
      JSON.stringify(attackScriptReportValidate.errors, null, 2)
    ).toBe(true);
    expect(
      promptExecutionValidate(readJson("outputs/adversarial_prompt_execution.json")),
      JSON.stringify(promptExecutionValidate.errors, null, 2)
    ).toBe(true);
    expect(
      promptExecutionValidate(readJson("outputs/adversarial_prompt_execution_multimodel.json")),
      JSON.stringify(promptExecutionValidate.errors, null, 2)
    ).toBe(true);
    expect(
      annotationPacketValidate(readJson("outputs/annotation_packet.json")),
      JSON.stringify(annotationPacketValidate.errors, null, 2)
    ).toBe(true);
    expect(
      annotationPacketV2Validate(readJson("outputs/annotation_packet_v2.json")),
      JSON.stringify(annotationPacketV2Validate.errors, null, 2)
    ).toBe(true);
    expect(
      interRaterValidate(readJson("outputs/inter_rater_report.json")),
      JSON.stringify(interRaterValidate.errors, null, 2)
    ).toBe(true);
    expect(
      interRaterV2Validate(readJson("outputs/inter_rater_report_v2.json")),
      JSON.stringify(interRaterV2Validate.errors, null, 2)
    ).toBe(true);
    expect(
      releaseChecklistValidate(readJson("outputs/release_checklist.json")),
      JSON.stringify(releaseChecklistValidate.errors, null, 2)
    ).toBe(true);
    expect(
      statisticalReportValidate(readJson("outputs/statistical_report.json")),
      JSON.stringify(statisticalReportValidate.errors, null, 2)
    ).toBe(true);
    expect(
      runtimeManifestValidate(readJson("outputs/runtime_manifest.json")),
      JSON.stringify(runtimeManifestValidate.errors, null, 2)
    ).toBe(true);
    expect(
      enforcementReportValidate(readJson("outputs/enforcement_report.json")),
      JSON.stringify(enforcementReportValidate.errors, null, 2)
    ).toBe(true);
    expect(
      runtimeEnforcementReportValidate(readJson("outputs/runtime_enforcement_report.json")),
      JSON.stringify(runtimeEnforcementReportValidate.errors, null, 2)
    ).toBe(true);
    expect(
      signedConsentReportValidate(readJson("outputs/signed_consent_report.json")),
      JSON.stringify(signedConsentReportValidate.errors, null, 2)
    ).toBe(true);
    expect(
      keyCustodyReportValidate(readJson("outputs/key_custody_report.json")),
      JSON.stringify(keyCustodyReportValidate.errors, null, 2)
    ).toBe(true);
    expect(
      processEgressGuardReportValidate(readJson("outputs/process_egress_guard_report.json")),
      JSON.stringify(processEgressGuardReportValidate.errors, null, 2)
    ).toBe(true);
    expect(
      containerNetworkConfinementReportValidate(readJson("outputs/container_network_confinement_probe.json")),
      JSON.stringify(containerNetworkConfinementReportValidate.errors, null, 2)
    ).toBe(true);
    expect(
      toolTraceReportValidate(readJson("outputs/tool_trace_report.json")),
      JSON.stringify(toolTraceReportValidate.errors, null, 2)
    ).toBe(true);
    expect(
      aggregateRiskReportValidate(readJson("outputs/aggregate_risk_report.json")),
      JSON.stringify(aggregateRiskReportValidate.errors, null, 2)
    ).toBe(true);
    expect(
      aggregateAttackReportValidate(readJson("outputs/aggregate_attack_report.json")),
      JSON.stringify(aggregateAttackReportValidate.errors, null, 2)
    ).toBe(true);
    expect(
      aggregateEmpiricalAttackReportValidate(readJson("outputs/aggregate_empirical_attack_report.json")),
      JSON.stringify(aggregateEmpiricalAttackReportValidate.errors, null, 2)
    ).toBe(true);
    expect(
      executableAggregateAttackReportValidate(readJson("outputs/executable_aggregate_attack_report.json")),
      JSON.stringify(executableAggregateAttackReportValidate.errors, null, 2)
    ).toBe(true);
    expect(
      aggregatePrivacyChallengeReportValidate(readJson("outputs/aggregate_privacy_challenge_report.json")),
      JSON.stringify(aggregatePrivacyChallengeReportValidate.errors, null, 2)
    ).toBe(true);
    expect(
      annotationAgreementReportValidate(readJson("outputs/annotation_agreement_report.json")),
      JSON.stringify(annotationAgreementReportValidate.errors, null, 2)
    ).toBe(true);
    expect(
      baselineSubmissionReportValidate(readJson("outputs/baseline_submission_report.json")),
      JSON.stringify(baselineSubmissionReportValidate.errors, null, 2)
    ).toBe(true);
    expect(
      baselineLeaderboardReportValidate(readJson("outputs/baseline_leaderboard_report.json")),
      JSON.stringify(baselineLeaderboardReportValidate.errors, null, 2)
    ).toBe(true);
    expect(
      externalTraceEvaluationReportValidate(readJson("outputs/external_trace_evaluation_report.json")),
      JSON.stringify(externalTraceEvaluationReportValidate.errors, null, 2)
    ).toBe(true);
    expect(
      brokerAttestationReportValidate(readJson("outputs/broker_attestation_report.json")),
      JSON.stringify(brokerAttestationReportValidate.errors, null, 2)
    ).toBe(true);
    expect(
      sandboxedTraceRunnerReportValidate(readJson("outputs/sandboxed_trace_runner_report.json")),
      JSON.stringify(sandboxedTraceRunnerReportValidate.errors, null, 2)
    ).toBe(true);
    expect(
      submittedArtifactRunnerReportValidate(readJson("outputs/submitted_artifact_runner_report.json")),
      JSON.stringify(submittedArtifactRunnerReportValidate.errors, null, 2)
    ).toBe(true);
    expect(
      artifactBundleVerificationReportValidate(readJson("outputs/artifact_bundle_verification_report.json")),
      JSON.stringify(artifactBundleVerificationReportValidate.errors, null, 2)
    ).toBe(true);
    expect(
      artifactTransparencyLedgerReportValidate(readJson("outputs/artifact_transparency_ledger_report.json")),
      JSON.stringify(artifactTransparencyLedgerReportValidate.errors, null, 2)
    ).toBe(true);
    expect(
      runnerHardeningReportValidate(readJson("outputs/runner_hardening_report.json")),
      JSON.stringify(runnerHardeningReportValidate.errors, null, 2)
    ).toBe(true);
    expect(
      measurementValidityReportValidate(readJson("outputs/measurement_validity_report.json")),
      JSON.stringify(measurementValidityReportValidate.errors, null, 2)
    ).toBe(true);
    expect(
      labelCalibrationPacketValidate(readJson("outputs/label_calibration_packet.json")),
      JSON.stringify(labelCalibrationPacketValidate.errors, null, 2)
    ).toBe(true);
    expect(
      scenarioProvenanceReportValidate(readJson("outputs/scenario_provenance_report.json")),
      JSON.stringify(scenarioProvenanceReportValidate.errors, null, 2)
    ).toBe(true);
    expect(
      externalValidationGateValidate(readJson("outputs/external_validation_gate.json")),
      JSON.stringify(externalValidationGateValidate.errors, null, 2)
    ).toBe(true);
    expect(
      scenarioCoverageValidate(readJson("outputs/scenario_coverage_report.json")),
      JSON.stringify(scenarioCoverageValidate.errors, null, 2)
    ).toBe(true);
    expect(
      constructValidityValidate(readJson("outputs/construct_validity_report.json")),
      JSON.stringify(constructValidityValidate.errors, null, 2)
    ).toBe(true);
    expect(
      scorecardStressReportValidate(readJson("outputs/scorecard_stress_report.json")),
      JSON.stringify(scorecardStressReportValidate.errors, null, 2)
    ).toBe(true);
    expect(
      artifactManifestValidate(readJson("outputs/artifact_manifest.json")),
      JSON.stringify(artifactManifestValidate.errors, null, 2)
    ).toBe(true);
    expect(
      publicValidationValidate(readJson("outputs/public_validation_report.json")),
      JSON.stringify(publicValidationValidate.errors, null, 2)
    ).toBe(true);
    expect(
      harnessReportValidate(readJson("outputs/harness_report.json")),
      JSON.stringify(harnessReportValidate.errors, null, 2)
    ).toBe(true);
    expect(
      harnessRunValidate(readFirstJsonl("outputs/harness_runs/reference-policy__data-rights-request.jsonl")),
      JSON.stringify(harnessRunValidate.errors, null, 2)
    ).toBe(true);
    expect(
      harnessRunValidate(readFirstJsonl("outputs/harness_model_runs/openai-compatible-gemma4-26b__data-rights-request.jsonl")),
      JSON.stringify(harnessRunValidate.errors, null, 2)
    ).toBe(true);
    expect(
      holdoutCommitmentValidate(readJson("outputs/holdout_commitment.json")),
      JSON.stringify(holdoutCommitmentValidate.errors, null, 2)
    ).toBe(true);
    expect(
      scenarioGenerationReportValidate(readJson("outputs/scenario_generation_report.json")),
      JSON.stringify(scenarioGenerationReportValidate.errors, null, 2)
    ).toBe(true);
    expect(
      sovereigntyFrontierReportValidate(readJson("outputs/sovereignty_frontier_report.json")),
      JSON.stringify(sovereigntyFrontierReportValidate.errors, null, 2)
    ).toBe(true);
    if (existsSync(resolve(root, "outputs/difficulty_calibration_report.json"))) {
      expect(
        difficultyCalibrationReportValidate(readJson("outputs/difficulty_calibration_report.json")),
        JSON.stringify(difficultyCalibrationReportValidate.errors, null, 2)
      ).toBe(true);
    }
  });
});
