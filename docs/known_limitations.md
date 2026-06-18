# Known Limitations

This project is intentionally honest about what it does not prove.

## Benchmark Validity

- The current scenario library is synthetic.
- The generated public corpus increases scenario breadth but remains templated synthetic data; the grammar is public, and private seed commitments do not prevent distribution-level contamination.
- The scoring functions are transparent heuristics, not externally validated measurement instruments.
- The scorecard stress report checks obvious collapse modes, but it is still author-calibrated and not a substitute for human-label validation.
- The benchmark has not been calibrated against human annotators.
- The annotation agreement report is executable, but the checked-in annotation is a seed example and does not count as independent review.
- The baseline submission report is executable, but the checked-in submission is an author seed fixture and does not count as an external baseline.
- The external trace evaluator is executable, but the checked-in trace is a seed fixture and does not count as an independent system submission.
- The broker attestation report replays checked-in trace fixtures and applies keyed-integrity tags (HMAC-SHA256, public fixture key), including a negative raw-upload control, but does not count as independent system evidence or production broker execution.
- The sandboxed trace runner executes checked-in trace fixtures in a guarded child process and preserves escape-attempt negative controls, but does not count as independent production-agent execution.
- The submitted-artifact runner executes checked-in fixture artifacts and binds source digests to emitted traces, but does not count as independent baseline evidence or production multi-tenant sandboxing.
- The canary execution harness detects verbatim and trivially encoded canary exfiltration at the egress boundary, but it does not detect paraphrase, semantic leakage, or every side channel.
- `pnpm demo:leak` is a fixture demonstration of the egress tap, not evidence that arbitrary agents or production systems are contained.
- The sovereignty-usefulness frontier is generated from committed harness records; the live local-model row is a platform-tagged run record, not a full-suite live-model benchmark.
- The v2 annotation packet and agreement report are ready for outside labels, but instrument validation remains blocked until private independent annotations meet the reviewer and overlap thresholds.
- The benchmark includes a real local-model sweep (`gemma4:26b`, `qwen3:4b`, `llama3.2:3b`); `gemma4:26b` is the only model that reliably emits the required auditable JSON plan, while the 3-4B models score low on format compliance, not detected leaks. It does not yet compare multiple strong real model or production agent implementations.

## Privacy and Security

- The project does not provide formal differential privacy guarantees.
- The project does not include a secure enclave, encrypted local data store, or production egress broker.
- The project now implements tamper-evident consent receipts, a tamper-evident consent-ledger hash chain (each record commits the previous digest, verifiable), keyed-integrity tags (HMAC-SHA256 under a public fixture key, providing integrity/tamper-evidence but not authenticity), deterministic key lifecycle probes, broker replay attestations, sandboxed runner attestations, revocation, expiry, retention deadlines, application-level storage-backed fetch mediation, a Node child-process preload egress guard, a macOS sandbox probe, and a Docker network-none probe, but does not provide production key custody, authenticity, legal non-repudiation, identity-bound broker attestations, or complete runtime confinement.
- The project now stress-tests aggregate candidates for synthetic linkability, reconstruction risk, attack-shaped rare-cohort/linkage/differencing pressure, synthetic cohort uniqueness, executable differencing/linkage/small-cell attacks, and semi-realistic microdata target inference, but does not prove that aggregates are non-reconstructable.
- The storage-backed runtime enforcement prototype, process preload guard, sandboxed trace runner, submitted-artifact Docker profile, and confinement probes do not prevent every native networking path, unguarded spawned process, missing preload, filesystem channel, IPC path, package-install path, or lower-level system path from moving data.

## Agent Behavior

- The primary demo model is deterministic and mocked.
- The adversarial suite includes deterministic prompt execution and platform-tagged local-model difficulty calibration, but not a full live prompt-injection benchmark across strong deployed systems.
- The T2/T3/T4 attack scripts are deterministic and replay-tested. The difficulty calibration report measures the configured local model(s) and scripts only; it is a saturation guard for this release, not a claim that the suite is calibrated against frontier or production agents.
- `pnpm model:eval` can test a local OpenAI-compatible model, and the checked-in transcript output preserves one `gemma4:26b` run; this is evidence of model behavior, not a general model-safety result.
- The tool-trace report uses deterministic in-process tool adapters. The demo does not integrate browsers, email, calendars, file systems, financial APIs, or real business endpoints.
- The autonomy levels are simulated rather than connected to real external actions.

## Product Scope

- The UI is a benchmark workbench, not a production personal assistant.
- The demo has no authentication, persistence, account model, or deployment hardening.
- The metrics are designed to make tradeoffs visible, not to certify safety.

## Responsible Claim

The defensible claim is:

> This repo defines a serious benchmark scaffold for user-sovereign personal-agent evaluation and demonstrates it with a deterministic local simulation.

The indefensible claim would be:

> This repo proves that a personal AI agent is private, safe, or ready for production.
