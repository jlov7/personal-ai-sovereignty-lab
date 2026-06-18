# Research Roadmap

## Phase 1: Public Artifact Foundation

- Deterministic agent simulation
- Scenario library
- Governance policy engine
- Evaluation harness
- Local UI
- Technical docs and threat model

Status: implemented in this repo.

## Phase 2: Adversarial Evaluation

- Add prompt-injection variants for each scenario
- Add overreach scenarios where the agent tries to act without consent
- Add aggregate reconstruction tests
- Add red-team scoring dimensions
- Publish a benchmark card with assumptions and known weaknesses

Status: adversarial prompt variants, deterministic safe/unsafe execution, overreach fixtures, tiered T2/T3/T4 harness scripts, bounded local-model adversarial calibration, executable tool-call traces, and synthetic aggregate-risk probes are implemented. Empirical reconstruction attacks remain open. A model-driven adaptive attacker is deliberately deferred until deterministic attack scripts are stable and calibrated.

## Phase 3: Local Model Adapters

- Add optional adapters for local model runtimes
- Compare deterministic policy decisions against model-generated plans
- Add structured output validation
- Measure latency and failure modes on local hardware

Status: initial OpenAI-compatible local HTTP adapter and transcript evaluator are implemented through `pnpm model:eval`. The repo preserves one full `gemma4:26b` transcript sweep plus bounded `qwen3:4b`, `llama3.2:3b`, adversarial calibration artifacts, deterministic in-process tool traces, brokered trace attestations, sandboxed trace-runner attestations over submitted action traces, and digest-bound submitted-artifact fixture receipts. The next step is stronger live model and production tool-agent baselines submitted through the artifact contract.

## Phase 4: Personal Data Substrate

- Add local encrypted fixture store
- Add storage-backed revocation and retention policies
- Add provenance records for every agent action
- Replace simulated tamper-evident consent receipts with signed consent receipts

Status: simulated consent receipts, keyed fixture signatures, deterministic key lifecycle probes, brokered trace attestations, sandboxed trace-runner attestations, submitted-artifact receipts, revocation, expiry, retention deadlines, egress guard probes, storage-backed runtime fetch mediation, a Node child-process preload egress guard, macOS sandbox and Docker network-none probes, submitted-artifact Docker profile probes, and in-process tool-call traces are implemented. Secure storage, production signing, and production broker execution remain open.

## Phase 5: Research Paper / Preprint

Candidate framing:

> Evaluating User-Sovereign Personal AI Agents: Boundary Decisions, Consent Gates, and Privacy-Utility Tradeoffs in Local-First Agent Systems.

Research questions:

- How should personal agents trade off usefulness and minimization?
- Which boundary decisions are understandable to users?
- Can consent-gated agents remain useful under realistic latency and data constraints?
- Which aggregates are safe enough for collective intelligence?

Prerequisite: add human annotation using `docs/annotation_rubric.md`, report inter-rater agreement, and compare human scores against deterministic policy-oracle findings.

## Phase 6: Public Program

- Publish benchmark cards
- Invite scenario contributions
- Add reproducibility badges
- Build a larger corpus of personal-agent failure cases
- Compare centralized, local-first, and hybrid personal AI patterns

Status: `docs/public_validation_protocol.md` defines the first public validation tracks. Independent reviewers, stronger baselines, and public replication evidence are still required before a validated-benchmark claim.
