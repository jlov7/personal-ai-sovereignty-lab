# Architecture

Personal AI Sovereignty Lab uses a three-layer model.

## Layer 1: On-Device / Local Intelligence

Layer 1 is the default boundary. It can inspect raw notes, personal memory, health-like journals, financial transactions, learning records, negotiation constraints, and household records. The current implementation simulates this with deterministic TypeScript fixtures and policy rules.

Responsibilities:

- parse the user objective
- inspect sensitivity and purpose
- draft useful output locally
- classify data-boundary decisions
- block unsafe releases

## Layer 2: Personal Cloud / Private Compute

Layer 2 represents user-controlled private compute. It can receive minimized summaries, redacted drafts, indexes, or consent-approved payloads. It should not receive raw personal corpora by default.

Responsibilities:

- heavier ranking, formatting, or comparison
- cross-device continuity
- private memory indexes
- explicit consent handling

## Layer 3: Federated or Consent-Based Collective Intelligence

Layer 3 represents collective learning, external agent negotiation, or federated analytics. It receives only non-identifying aggregates or user-approved payloads.

Responsibilities:

- aggregate benchmark comparison
- agent-to-business negotiation
- consented collective intelligence
- privacy-budget-aware contribution

## Control Flow

1. User selects a scenario.
2. The local agent reads scenario data declarations.
3. The governance engine classifies each data item.
4. The agent produces a local plan, pauses for consent where needed, and blocks unsafe releases.
5. The evaluation harness scores the run.
6. The UI renders scenario, decision, permissions, data-flow trace, scorecard, and risk notes.

## Submitted Trace Broker

External systems can submit action-level traces without changing the core benchmark. The post-hoc evaluator scores those traces, and the deterministic broker replays each action through the same policy, consent, release-form, host-allowlist, and aggregate-control rules before signing an attestation payload.

The sandboxed trace runner then executes broker-approved trace actions inside a guarded child process, skips broker-blocked actions before execution, and records direct escape-attempt denials. The submitted-artifact runner adds a further fixture layer: it executes submitted artifact source, binds source digests to emitted traces and signed receipts, and probes a Docker hardened profile for network, filesystem, and environment controls. These are execution-shaped benchmark layers, not production confinement. The broker and runners reference the process, macOS, and Docker confinement probes as surrounding evidence, but `pnpm eval` does not run arbitrary third-party packages inside a hardened production sandbox.

## Design Tradeoffs

- The system uses deterministic fixtures instead of a live LLM so behavior is reproducible.
- The policy engine is intentionally readable rather than hidden behind a complex policy DSL.
- The UI is an executable explanation of the architecture, not a production assistant.
- Scoring is transparent and heuristic; it is suitable for regression and review, not scientific claims.
- Broker attestations are signed with deterministic fixture keys so tests can detect tampering without claiming production non-repudiation.
