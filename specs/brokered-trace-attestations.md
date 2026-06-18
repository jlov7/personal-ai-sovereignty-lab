## Feature: Brokered Trace Attestations

### Requirements

- [R1] Must execute submitted external traces through a deterministic broker policy before they are treated as benchmark evidence.
- [R2] Must emit signed broker attestations for every loaded external trace.
- [R3] Must connect each attestation to the existing external trace evaluator result.
- [R4] Must include a negative-control trace where a submitted system claims a raw external upload completed and the broker blocks it.
- [R5] Must expose a machine-readable report and JSON Schema.

### Constraints

- [C1] Cannot claim production confinement, production key custody, or legal non-repudiation.
- [C2] Must remain deterministic and runnable with `pnpm eval`.
- [C3] Must not require Docker or macOS sandboxing inside `pnpm eval`; those remain separate enforcement probes.

### Acceptance Criteria

- [x] `pnpm eval` writes `outputs/broker_attestation_report.{json,md}`.
- [x] Schema tests validate the broker attestation report.
- [x] Unit tests prove safe traces verify, unsafe completed raw release is blocked, and attestation tampering is detected.
- [x] README and benchmark docs describe broker attestations as stronger than post-hoc trace scoring but weaker than production broker integration.
- [x] Strict frontier score is updated honestly without crossing into external-validation claims.

### Out of Scope

- Real process/container execution of arbitrary third-party code.
- Hardware-backed signing keys.
- Production API calls.
- Human annotation or external baseline collection.
