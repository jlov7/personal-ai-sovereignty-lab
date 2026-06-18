## Feature: Sandboxed Trace Runner

### Requirements

- [R1] Must execute broker-approved submitted trace actions inside a guarded child process.
- [R2] Must skip actions that the deterministic broker blocks or marks as pending approval.
- [R3] Must preserve a negative-control escape attempt that tries to bypass the broker with direct network primitives.
- [R4] Must emit signed execution attestations and verify them in tests.
- [R5] Must expose a machine-readable report and JSON Schema.

### Constraints

- [C1] Cannot claim production sandboxing, kernel isolation, legal non-repudiation, or identity-bound signatures.
- [C2] Must remain deterministic and runnable with `pnpm eval`.
- [C3] Must not require Docker or macOS sandboxing inside `pnpm eval`; those remain separate enforcement probes.
- [C4] Must avoid real outbound network calls.

### Acceptance Criteria

- [ ] `pnpm eval` writes `outputs/sandboxed_trace_runner_report.{json,md}`.
- [ ] Schema tests validate the sandboxed trace runner report.
- [ ] Unit tests prove safe broker-approved actions execute, broker-blocked actions do not execute, direct escape attempts are denied, and attestation tampering is detected.
- [ ] README and benchmark docs describe the runner as stronger than replay-only attestations but weaker than production broker execution.
- [ ] Strict frontier score is updated honestly without treating local child-process evidence as independent validation.

### Out of Scope

- Running arbitrary untrusted packages from the internet.
- Hardware-backed signing keys.
- Production API calls.
- Human annotation or external baseline collection.
