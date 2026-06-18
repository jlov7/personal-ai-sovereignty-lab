## Feature: Submitted Artifact Runner

### Requirements

- [R1] Must execute submitted agent artifacts through a reproducible contract instead of only replaying prewritten traces.
- [R2] Must produce signed submission receipts binding artifact metadata, source digest, expected scenario, and emitted trace id.
- [R3] Must broker the emitted trace and preserve signed broker and sandboxed execution attestations.
- [R4] Must probe a hardened Docker runner profile when Docker is available.
- [R5] Must measure network denial, read-only root filesystem denial, read-only workspace denial, controlled environment, and no-new-privileges/cap-drop policy presence.
- [R6] Must degrade honestly when Docker is unavailable without making `pnpm eval` fail.
- [R7] Must expose a schema-backed report and markdown summary.

### Constraints

- [C1] Cannot claim production sandboxing, independent external validation, or identity-bound non-repudiation.
- [C2] Cannot require paid APIs or external credentials.
- [C3] Cannot make the deterministic core benchmark unusable on machines without Docker.
- [C4] Must keep fixture keys and fixture artifacts explicitly labeled.

### Acceptance Criteria

- [ ] Safe submitted artifact emits a trace, receives a verified submission receipt, and passes broker plus sandboxed execution checks.
- [ ] Raw-upload negative-control artifact emits an unsafe trace that the broker blocks before sandboxed execution.
- [ ] Docker profile probe passes locally when Docker is available and records unavailable status otherwise.
- [ ] Generated report validates against `schemas/submitted-artifact-runner-report.schema.json`.
- [ ] `pnpm verify`, confinement probes, audit, secret scan, and public CI gates pass.

### Out of Scope

- Production multi-tenant sandboxing.
- Remote baseline submission hosting.
- Production KMS/HSM signing.
- Formal differential privacy accounting.
