import type { Scenario } from "../shared/types";

export function renderHuggingFaceJsonl(scenarios: Scenario[]): string {
  return `${scenarios
    .map((scenario) =>
      JSON.stringify({
        id: scenario.id,
        title: scenario.title,
        domain: scenario.domain,
        task: scenario.task,
        userObjective: scenario.userObjective,
        requestedAutonomy: scenario.requestedAutonomy,
        architectureLayerFocus: scenario.architectureLayerFocus,
        externalInteraction: scenario.externalInteraction,
        requiresBoundaryCrossingForSuccess: scenario.requiresBoundaryCrossingForSuccess,
        dataBoundaryItems: scenario.dataItems.map((item) => ({
          id: item.id,
          sensitivity: item.sensitivity,
          defaultBoundary: item.defaultBoundary,
          allowedLayers: item.allowedLayers,
          containsPii: item.containsPii,
          dataVolume: item.dataVolume
        })),
        riskTriggers: scenario.riskTriggers,
        successCriteria: scenario.successCriteria,
        failureModes: scenario.failureModes
      })
    )
    .join("\n")}\n`;
}

export function renderHuggingFaceDatasetCard(scenarios: Scenario[]): string {
  const domains = [...new Set(scenarios.map((scenario) => scenario.domain))].sort();

  return `---
license: mit
pretty_name: Personal AI Sovereignty Benchmark Scaffold
task_categories:
  - text-generation
  - question-answering
  - other
language:
  - en
tags:
  - ai-evaluation
  - agents
  - privacy
  - local-first
  - governance
  - consent
size_categories:
  - n<1K
---

# Personal AI Sovereignty Benchmark Scaffold

This is a Hugging Face-ready local dataset package for the Personal AI Sovereignty Lab (PAISL). It is prepared for publication, but this repository does not claim that the dataset has already been published or independently validated.

## Contents

- \`dataset_preview.jsonl\`: ${scenarios.length} synthetic personal-agent scenario records, including the curated scored suite and generated public corpus.
- \`../outputs/sample_run_log.json\`: deterministic policy-simulator runs and scorecards.
- \`../outputs/harness_report.md\`: execution-level canary harness controls.
- \`../outputs/sovereignty_frontier_report.md\`: SLR/usefulness frontier generated from harness records.
- \`../outputs/statistical_report.md\`: bootstrap interval and score-weight sensitivity.
- \`../outputs/enforcement_report.md\`: executable consent, revocation, retention, and egress probes.
- \`../outputs/runtime_enforcement_report.md\`: file-backed consent ledger and fetch-mediated egress audit probes.
- \`../outputs/tool_trace_report.md\`: executable tool-call traces and unsafe raw-egress negative controls.
- \`../outputs/aggregate_risk_report.md\`: synthetic aggregate reconstruction and linkability risk probes.
- \`../outputs/construct_validity_report.md\`: local validity checks and external blockers.
- \`../outputs/adversarial_prompt_execution_multimodel.md\`: full local adversarial sweep over all 153 prompt variants for gemma4:26b, qwen3:4b, and llama3.2:3b.
- \`../outputs/annotation_packet.md\`: external-review packet.
- \`../outputs/annotation_packet_v2.md\`: blind harness-run sample for independent annotation.
- \`../outputs/inter_rater_report_v2.md\`: blocked-external agreement report until private outside labels exist.
- \`../outputs/artifact_manifest.md\`: SHA-256 manifest for public artifacts.
- \`../schemas/scenario.schema.json\`: scenario compatibility contract.

## Domains

${domains.map((domain) => `- ${domain}`).join("\n")}

## Intended Use

Use this package to prototype benchmarks for personal AI agents that must reason across local, private-compute, and consent-based collective layers while preserving user control.

## Out Of Scope

- Not a validated scientific benchmark.
- Not medical, legal, financial, or benefits advice.
- Not evidence that any model is safe for deployment as a personal agent.
- Not a human-subject dataset.

## Data Provenance

All scenarios are synthetic fixtures authored for benchmark design. They intentionally include privacy-sensitive task shapes, but they do not contain real personal records.

## Required Validation Before Public Benchmark Claims

1. Independent annotation by at least three reviewers.
2. Inter-rater agreement over overlapping cases.
3. Broader model and tool-agent baselines.
4. Adversarial prompt execution against live systems.
5. Empirical aggregate reconstruction attacks and privacy review for any future real or semi-real data.
`;
}
