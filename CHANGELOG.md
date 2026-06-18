# Changelog

## 1.0.0-rc.0 - 2026-06-11

- Restructured the public communication surface around the benchmark question, canary harness, sovereignty-usefulness frontier, five-minute leak demo, and honest limitations.
- Added `pnpm demo:leak` as an offline malicious-fixture walkthrough that prints the transcript, egress tap, caught canary, and one-line verdict.
- Added `pnpm paper:tables` and rewrote the generated paper draft around the five contribution claims with tables generated from committed outputs.
- Replaced the placeholder difficulty-calibration command with a local-model runner, schema, report, and saturation-guard tests.
- Refreshed the Hugging Face package to use the expanded public scenario corpus and render frontier rows plus the committed SVG in the Space template.
- Added README numeric-claim pinning so public-facing numbers cannot drift from their generating artifacts.

## 0.25.0 - 2026-06-11

- Added a blind v2 annotation packet sampled from harness run records with automated scores, leak findings, run ids, agent ids, and stratum labels removed.
- Added a deterministic boundary-usefulness harness control so annotation sampling has real partial-usefulness cases instead of duplicated pass/fail controls.
- Added v2 private-annotation agreement reporting with pairwise Cohen's kappa, nominal Krippendorff alpha, human/automated majority agreement, and pre-registered interpretation thresholds.
- Kept instrument validation blocked_external until private independent labels exist under gitignored `private/annotations/`.

## 0.24.0 - 2026-06-11

- Added a sovereignty-usefulness frontier report generated from execution-level harness run records.
- Added a deterministic hand-written SVG figure plotting usefulness against sovereignty (`1 - SLR`) for combined all-tier rows.
- Added schema and regression tests for frontier ordering, deterministic rendering, and optional live harness model run ingestion.
- Documented the exact SLR, usefulness, sovereignty, over-ask, and 95% bootstrap interval formulas in the methodology.

## 0.23.0 - 2026-06-11

- Added a free-first model adapter layer with deterministic, local OpenAI-compatible/Ollama, and dynamically loaded Anthropic adapter paths.
- Added a remote-adapter gate requiring `PAISL_REMOTE_EVAL=1`, provider credentials, `--i-am-spending-money`, `--max-runs`, and confirmation before any remote model can construct.
- Routed the existing local model plan helpers through the adapter layer and enabled `pnpm harness:model` for execution-level local-model canary runs.
- Added submitted harness sweep verification that rejects digest-tampered run records and claimed leak findings the local detector cannot reproduce.

## 0.22.0 - 2026-06-11

- Added a seeded, schema-valid scenario generator with a locked in-repo PRNG, template grammar, and near-duplicate rejection.
- Added 400 generated public scenarios while preserving the 51-scenario curated scoring lineage and 91.06 reference-policy score.
- Added a holdout seed commitment artifact, scenario-generation report, contamination policy, schemas, and regression tests.
- Documented the limitation that generated scenarios remain public-grammar synthetic fixtures, not real-user evidence or contamination-proof validation.

## 0.21.0 - 2026-06-11

- Added deterministic T2/T3/T4 attack scripts for multi-turn escalation, indirect injection, fake consent, memory poisoning, and role confusion.
- Added fixture replay controls proving the compliant harness agent resists every script while the naive agent leaks.
- Added an attack-script report, schemas, tests, and a live-calibration CLI that writes no evidence unless a local model endpoint is configured.
- Left model-driven adaptive attack generation in the roadmap until deterministic scripts are stable and calibrated.

## 0.20.0 - 2026-06-11

- Added an execution-level canary harness with deterministic canary seeding, transform-aware leak detection, a single egress tap, in-process tool registry, and multi-turn run records.
- Added hermetic `pnpm harness:eval` output generation for `outputs/harness_report.{json,md}` and per-run JSONL transcripts under `outputs/harness_runs/`.
- Added validity-control regression tests: the reference policy must produce zero disallowed canary leaks and the centralized negative control must leak.
- Documented the canary detector's limit: it catches verbatim and trivially encoded exfiltration, not semantic leakage or production confinement.

## 0.19.0 - 2026-06-11

- Extracted the deterministic evaluator core into isolated `src/core/` modules for types, boundary policy, scoring, and the reference run loop.
- Preserved legacy import paths as compatibility re-exports, so generated artifacts keep the historical v0.18 scoring lineage without treating it as the current public release label.
- Added a core-isolation regression test and a reviewer reading guide that records the current 955-line core size and the 20-minute read path.

## 0.18.0 - 2026-05-29

- Switched to behaviour-derived scoring: violations are now inferred from observed data flow rather than self-reported tags.
- Replaced prior runs with a real, reproducible local-model sweep (gemma4:26b, qwen3:4b, llama3.2:3b) under fixed decoding settings.
- Added a tamper-evident consent ledger hash chain (each record commits the previous digest; verifiable).
- Made the eval hermetic.
- Adopted honest crypto/sandbox language: keyed-integrity tags (HMAC-SHA256 under a public fixture key) provide integrity/tamper-evidence, not authenticity; the submitted-artifact runner is unsandboxed on the host unless routed through the Docker hardened profile, and the in-process egress guard is advisory.
- Removed all self-assigned numeric scores; the project is described qualitatively as a credible scaffold with strong local evidence and no independent validation yet.

## 0.17.0-submitted-artifact-runner - 2026-05-23

- Added fixture submitted artifacts that execute as source programs and emit external action traces.
- Added signed submission receipts binding source SHA-256 digests, emitted trace ids, broker attestation ids, and sandboxed execution attestation ids.
- Added Docker hardened-profile probes for network-none denial, read-only workspace/root filesystem denial, tmpfs scratch behavior, controlled environment, dropped capabilities, and no-new-privileges.
- Added schema-backed `submitted_artifact_runner_report` artifacts, regression tests, a public workflow, and v0.17 release documentation.
- Reaffirmed the honest limitation framing, preserving the independent-validation, production-broker, production-key-custody, Hugging Face, and real-data blockers.

## 0.16.0-sandboxed-trace-runner - 2026-05-23

- Added a guarded child-process trace runner that executes broker-approved submitted trace actions and skips broker-blocked actions before child execution.
- Added direct escape-attempt negative controls for untrusted Fetch and raw socket egress, both denied by the runner preload guard.
- Added signed sandboxed execution attestations, schema-backed `sandboxed_trace_runner_report` artifacts, and regression tests for execution, skip, escape-denial, and tamper-detection behavior.
- Reaffirmed the honest limitation framing, preserving the independent-validation, production-broker, production-key-custody, Hugging Face, and real-data blockers.

## 0.15.0-broker-attestations - 2026-05-23

- Added a deterministic trace broker that replays submitted external action traces against policy, consent, release-form, host-allowlist, and aggregate controls.
- Added signed broker attestations with tamper detection, submitted-block confirmation, and a raw-upload negative control that is claimed completed but blocked by the broker.
- Added schema-backed `broker_attestation_report` artifacts and wired them into eval generation, schema validation, documentation checks, release packaging, and the strict frontier audit.
- Reaffirmed the honest limitation framing, preserving the independent-validation, production-broker, production-key-custody, Hugging Face, and real-data blockers.

## 0.14.0-cross-platform-custody-hardening - 2026-05-23

- Added deterministic key-custody lifecycle probes for active-key selection, rotation, retirement, revocation, historical receipt verification, envelope tampering, and custody-event hash-chain tampering.
- Added a Docker `--network none` container confinement probe with a positive control plus a public Ubuntu GitHub Actions workflow.
- Added schema-backed `key_custody_report` and `container_network_confinement_probe` artifacts.
- Reaffirmed the honest limitation framing, preserving the independent-validation, production-key-custody, Hugging Face, and real-data blockers.

## 0.13.0-runtime-privacy-hardening - 2026-05-23

- Added keyed signed-consent receipt probes for valid, tampered, revoked, and scope-mismatched consent.
- Added an aggregate privacy challenge over deterministic semi-realistic microdata to compare naive aggregate releases against blocked, suppressed, coarsened, and noisy controls.
- Added a macOS OS-network confinement probe using `sandbox-exec` plus a public GitHub Actions workflow for OS-level network-denial evidence.
- Reaffirmed the honest limitation framing, preserving the external-validation, production-key-custody, Hugging Face, and real-data blockers.

## 0.12.0-process-egress-guard - 2026-05-23

- Added a child-process preload egress guard for Fetch, HTTP, HTTPS, raw TCP, and TLS primitives.
- Added a schema-backed process egress guard report and regression test that prove nine offline probes pass without real outbound network calls.
- Reaffirmed the honest limitation framing, preserving the OS/network sandbox and external-validation blockers.

## 0.11.0-external-trace-evaluator - 2026-05-23

- Added an external agent trace schema and seed trace fixture for submitted baseline systems.
- Added a deterministic external trace evaluator that scores boundary, consent, aggregate-control, and unknown-data findings.
- Added generated report, schema validation, docs references, and tests for safe and unsafe submitted traces.

## 0.10.0-executable-aggregate-attack - 2026-05-23

- Added executable aggregate attack reporting for exact differencing, unique-bucket linkage, and small-cell reconstruction against deterministic aggregate fixtures.
- Added schema, generated report, and tests for the executable attack harness.
- Preserved the claim boundary: the attacks are executable and falsifiable, but still synthetic and not a formal differential privacy proof.

## 0.9.0-external-validation-gate - 2026-05-23

- Added an external validation gate that combines annotation, baseline submission, and aggregate-attack evidence into one blocked/candidate-ready release check.
- Added schema, generated report, and tests for the gate.
- Preserved the correct blocker state: seed annotations, seed baselines, and synthetic aggregate attacks keep the gate blocked.

## 0.8.0-external-validity-scaffold - 2026-05-23

- Added annotation agreement reporting that aggregates human annotation files, computes agreement only when enough overlapping independent labels exist, and preserves seed-only data as insufficient.
- Added baseline submission schema and report so external systems can submit auditable personal-agent traces without changing the core harness.
- Added a synthetic cohort uniqueness experiment for aggregate-risk probes to move aggregate privacy work beyond metadata-only heuristics.
- Added schemas, examples, tests, generated outputs, and documentation pointers for the new validation surfaces.
- Preserved the blocker boundary: the new infrastructure makes external validation easier, but does not pretend that external validation has happened.

## 0.7.0-frontier-recalibration-candidate - 2026-05-23

- Replaced overgenerous self-scoring with an honest benchmark-validity limitation framing.
- Added scorecard stress reporting for negative-control separation, local-only usefulness penalties, and ceiling-effect risk.
- Added synthetic aggregate attack reporting for rare-cohort linkage, auxiliary-context joins, and differencing pressure.
- Added schema validation for the new stress artifacts and pinned dependency ranges exactly to the lockfile.
- Preserved the main blocker honestly: local artifacts can improve benchmark readiness, but cannot substitute for independent annotation, stronger baselines, Hugging Face publication, empirical aggregate attacks, or OS/network enforcement.

## 0.6.1-public-validation-evidence - 2026-05-22

- Recorded public GitHub validation evidence in a schema-backed report.
- Added public CI, release, review-thread, and Hugging Face credential-blocker links.
- Bumped GitHub Actions to current major versions and preserved a passing public CI run.

## 0.6.0-public-validation-candidate - 2026-05-22

- Added a storage-backed consent ledger and fetch-mediated runtime egress prototype.
- Added runtime consent and egress audit logs, generated runtime-enforcement report, schema, and tests.
- Added public validation protocol documentation for independent annotation, baseline submissions, and aggregate-risk challenges.
- Prepared the repo for public GitHub CI and issue-based external review without claiming independent validation has happened.

## 0.5.0-local-release-candidate - 2026-05-22

- Added executable in-process tool-agent traces with local search, consented tool calls, aggregate calls, and unsafe raw-egress negative controls.
- Added aggregate reconstruction/linkability risk probes with explicit allow, require-control, and block decisions.
- Added tool-trace and aggregate-risk schemas, reports, tests, release checklist items, and construct-validity checks.
- Prepared the benchmark for a stricter local score increase without claiming production egress control or external validation.

## 0.4.0-local-release-candidate - 2026-05-22

- Added tamper-evident consent receipts, revocation, expiry, retention deadlines, and executable egress guard probes.
- Added enforcement, scenario coverage, construct-validity, and artifact-manifest reports.
- Added a brokered tool-agent baseline mediated by consent receipts and the egress guard.
- Added Docker/devcontainer reproducibility surfaces and artifact manifest verification.
- Added bounded `gemma4:26b` adversarial prompt calibration when the local Ollama runtime is available.
- Improved evidence where possible; external validation remains the primary blocker.

## 0.3.0-local-release-candidate - 2026-05-22

- Expanded the benchmark suite to 51 synthetic personal-agent scenarios.
- Added deterministic statistical reporting with bootstrap mean intervals and score-weight sensitivity.
- Added runtime manifest and Hugging Face-ready local dataset package.
- Added release hygiene files: license, citation, contribution guide, security policy, and CI workflow.
- Preserved the strict frontier-grade audit: local polish improves release readiness but does not replace independent validation.

## 0.2.0 - 2026-05-22

- Added adversarial prompt pack, external annotation packet, inter-rater report, release checklist, and model transcript schema.
- Captured a full local `gemma4:26b` transcript sweep and bounded `qwen3:4b` / `llama3.2:3b` calibration sweep.
- Added a stricter, qualitative frontier-grade bar (external-review based) and stopped treating scaffold-readiness as validity.

## 0.1.0 - 2026-05-22

- Created the local-first personal AI agent simulation, governance engine, evaluation harness, React demo, scenario library, schemas, generated outputs, and core documentation.
