# Public Validation Protocol

Status: `1.0.0-rc.0` public-validation readiness protocol.

This project is ready to be reviewed publicly as a benchmark scaffold. It is not yet a validated benchmark standard. The current repo includes artifact-bundle verification, a local transparency ledger, runner hardening probes, measurement calibration packets, scenario provenance/split/mutation evidence, six-family aggregate attack cards, a canary egress harness, tiered deterministic attack scripts, baseline leaderboard gates, custody attack probes, public-review issue forms, a claim-evidence index, falsification criteria, and a Hugging Face Space review template. The next evidence step is independent annotation, stronger baseline submissions through the artifact contract, realistic aggregate privacy/security challenges, production key custody, production broker execution, and actual outside criticism.

## Validation Tracks

| Track | Goal | Evidence Required |
| --- | --- | --- |
| Independent annotation | Test whether the policy oracle matches expert judgment | At least 3 reviewers, 5+ overlapping cases, disagreement analysis |
| Strong baseline traces | Compare against capable personal-agent implementations | Full scenario runs, action-level external traces, tool traces, consent decisions, failure cases |
| Broker attestations | Check submitted action claims before treating traces as execution-shaped evidence | Keyed-integrity-tagged broker replay payloads (HMAC-SHA256, public fixture key), completed-claim blocks, submitted-block confirmation, attestation verification |
| Sandboxed trace runner | Check that broker-approved trace actions can execute under a guard and direct escape attempts are denied | Keyed-integrity-tagged child-process execution attestations, skip counts for broker-blocked actions, guard audit events, escape-attempt denials |
| Submitted artifact runner | Check that submitted systems can be evaluated as executable artifacts rather than only hand-authored traces | Source digest, emitted trace, keyed-integrity submission receipt, broker attestation, sandboxed execution attestation, Docker hardened-profile probe |
| GitHub Actions replication | Prove the repo regenerates outside the author's machine | Required before public-validation claims: a passing GitHub Actions run on the current `main` revision, with evidence visible after any public launch |
| Aggregate-risk challenge | Stress test safe-aggregate assumptions | Reconstruction, linkage, differencing, small-cell, or auxiliary-context attempts against aggregate probes |
| Runtime enforcement | Move beyond simulated policy decisions | Storage-backed consent, auditable egress attempts, stronger sandboxing |
| Public criticism | Let outsiders falsify claims, scenarios, scorecards, and aggregate-risk assumptions | Issue submissions, accepted disputes, claim downgrades, regression tests, and visible rejected cases |

## Annotation Round 1

Use `outputs/annotation_packet.md` and `docs/annotation_rubric.md`.

Place completed annotations in the format defined by `schemas/annotation.schema.json`. `outputs/annotation_agreement_report.md` will aggregate them and compute agreement only after enough overlapping independent cases exist.

Each reviewer should label at least five overlapping cases across:

- privacy-boundary respect
- usefulness
- autonomy appropriateness
- consent clarity
- data minimization
- explanation quality

Do not resolve disagreements silently. Preserve them in a follow-up inter-rater report.

## Baseline Submission Format

A baseline submission should include:

- the agent or model name
- whether the agent used tools
- prompts or system instructions when shareable
- generated plan or action trace
- data items moved across boundaries
- consent requests made
- blocked data items
- failure cases
- environment and model/runtime versions

The preferred format is a JSON artifact compatible with `schemas/model-transcript-eval.schema.json` or a linked issue that can be converted into that format.

The formal submission contract is `schemas/baseline-submission.schema.json`. `outputs/baseline_submission_report.md` reports whether submitted systems are independent, production-grade, tool-using, and coverage-bearing.

For action-level scoring, submit traces using `schemas/external-agent-trace.schema.json`. `outputs/external_trace_evaluation_report.md` will normalize each submitted trace into boundary, consent, aggregate-control, and unknown-data findings. `outputs/broker_attestation_report.md` will replay those traces through the deterministic broker and apply a keyed-integrity tag (HMAC-SHA256, public fixture key) to the resulting execution/block decisions. `outputs/sandboxed_trace_runner_report.md` will execute broker-approved trace actions in a guarded child process and record escape-attempt denials. For runnable artifact-shaped evidence, follow the fixture pattern in `examples/submitted_artifacts/`; `outputs/submitted_artifact_runner_report.md` binds source digests, emitted traces, broker attestations, and sandbox attestations into keyed-integrity-tagged receipts.

## Runtime Enforcement Challenge

The runtime prototype is intentionally modest. It proves that an application-level adapter can:

- load consent from a file-backed ledger
- deny raw protected egress before a fetch call executes
- deny untrusted hosts before a fetch call executes
- deny previously valid consent after revocation
- write an audit log for every attempted egress

It does not prove complete isolation, legal consent validity, or formal privacy guarantees. The repo has macOS sandbox and Docker network-none probes, deterministic broker replay attestations, guarded child-process execution attestations, and submitted-artifact hardened-profile probes, but stronger contributions should target production broker execution, real key custody, and broader system confinement directly.

## Public Issue Labels

Suggested labels for the public repo:

- `annotation`
- `baseline`
- `scenario-design`
- `privacy-risk`
- `reproducibility`
- `aggregate-risk`
- `runtime-enforcement`

## Public Review Intake

Use the structured issue forms for artifact baseline submissions, annotation submissions, scenario criticism, aggregate attack reports, runner escape reports, and scorecard disputes. `docs/claim_evidence_index.md` maps claims to artifacts and workflows. `docs/falsification_criteria.md` defines the conditions that should trigger claim downgrade or retraction.

## Acceptance Bar For v1.0

Do not call this a validated benchmark until all of the following are true:

1. GitHub Actions passes on the current `main`, with workflow evidence visible after any public launch.
2. At least three independent reviewers annotate overlapping cases.
3. Inter-rater agreement and disagreements are published.
4. At least one strong tool-using baseline and one strong local/private baseline are evaluated.
5. Aggregate-risk assumptions are attacked, not merely described.
6. Runtime enforcement includes a stronger sandbox or broker boundary than application-level fetch mediation and is evaluated against submitted agents, not only fixture probes.
