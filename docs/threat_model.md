# Threat Model

This is a simulation, not a complete security system. The threat model documents what a serious version must defend.

## Assets

| Asset | Why It Matters |
| --- | --- |
| Raw personal memory | Can expose identity, relationships, plans, and private context |
| Financial records | Regulated and high-impact if leaked or misused |
| Health-like journals | Sensitive and easy to over-disclose |
| Learning records | Can expose minors, ability signals, and long-term profiles |
| Negotiation constraints | Can directly harm user bargaining power |
| Consent records | Determine whether a boundary crossing was legitimate |
| Broker attestations | Determine whether submitted action traces were actually replayed under policy rather than trusted as claims |
| Submitted artifact receipts | Bind runnable artifact source digests to emitted traces, broker attestations, and sandbox attestations |
| Canary markers | Expose whether protected fixture data crossed a disallowed egress boundary |
| Annotation packets | Carry reviewer-facing evidence and must not reveal automated labels or private annotator identity |

## Actors

| Actor | Capability | Concern |
| --- | --- | --- |
| User | Grants consent, reviews outputs | Needs clear control and revocation |
| Local agent | Reads raw local context | Could overreach or over-share |
| Private compute provider | Processes minimized payloads | Could retain or repurpose data |
| External business API | Receives negotiation payloads | Incentivized against the user |
| Collective benchmark layer | Receives aggregates | Reconstruction or linkage risk |
| Malicious prompt/source | Attempts exfiltration | Policy bypass and prompt injection |
| External baseline submitter | Provides action traces, runnable artifacts, and claimed outcomes | Could overstate completed safe behavior, substitute artifacts, or omit unsafe attempts |

## Threats and Controls

| Threat | Example | Current Control | Future Control |
| --- | --- | --- | --- |
| Raw data exfiltration | Raw transactions sent to private compute | `local_only` and `blocked` decisions | OS-level sandboxing, egress controls |
| Canary bypass | Protected fixture marker crosses a disallowed layer without a leak finding | `outputs/harness_report.md`, `outputs/sovereignty_frontier_report.md`, and `pnpm demo:leak` exercise the single egress tap and confirmed leak findings | Broader semantic-leak detectors, side-channel analysis, and production broker enforcement |
| Consent bypass | Agent contacts provider without approval | `requires_consent` gates, tests, and tamper-evident consent receipts | Signed consent receipts |
| Receipt tampering | Stored consent purpose or scope is edited after approval | `outputs/signed_consent_report.md` verifies keyed-integrity tags (HMAC-SHA256, public fixture key) and preserves scope/revocation denials; the consent ledger is a tamper-evident hash chain (each record commits the previous digest) | User-held signing keys for authenticity and hardware-backed storage |
| Key lifecycle failure | A retired or revoked key continues authorizing new consent receipts | `outputs/key_custody_report.md` tests active-key selection, retirement, revocation, historical verification, envelope tampering, and custody-log hash-chain tampering | Real user-held key custody, recovery, compromise response, and audited rotation |
| Bargaining leakage | Agent reveals max willingness to pay | External release block | Formal policy proofs for negotiation agents |
| Reconstruction from aggregates | Federated writing patterns expose draft content | Aggregate-only fixtures | Differential privacy and attack testing |
| Secondary use | Private cloud retains memory index forever | Roadmap documents revocation need | Retention policies, deletion attestations |
| Opaque autonomy | User cannot tell why an action happened | Decision rationales and policy tags | Auditable event log with provenance |
| Revoked consent ignored | Agent reuses last week's approval | Revoked receipt probe in `outputs/enforcement_report.md` and stored-ledger revocation in `outputs/runtime_enforcement_report.md` | OS-backed revocation registry with durable key management |
| Retention drift | Minimized payload remains in private compute indefinitely | Retention deadline in egress decisions | Deletion attestations and independent audit logs |
| Runtime fetch bypass | Application code calls a network API without passing through policy checks | `src/privacy/sovereignFetch.ts` blocks raw payloads, revoked consent, and untrusted hosts before fetch execution; `outputs/process_egress_guard_report.md` adds child-process preload probes for Fetch, HTTP, HTTPS, TCP, and TLS primitives; `outputs/os_network_confinement_probe.md` proves a macOS sandbox can deny loopback egress for the probed child process; `outputs/container_network_confinement_probe.md` proves Docker `--network none` denies the probed host egress path | Production broker integration, proxy enforcement, and broader sandbox policies beyond the probe paths |
| Trace-claim spoofing | Submitted baseline trace marks an unsafe external upload as completed or hides that it would have been blocked | `outputs/broker_attestation_report.md` replays submitted actions through policy, consent, release-form, host-allowlist, and aggregate controls, applies a keyed-integrity tag (HMAC-SHA256, public fixture key) to the broker decision payload, and detects attestation tampering | Production broker execution with identity-bound signatures, append-only logs, and sandboxed third-party agent runners |
| Runner escape attempt | Submitted or fixture code tries direct egress after broker approval | `outputs/sandboxed_trace_runner_report.md` executes broker-approved actions in a guarded child process and denies untrusted Fetch plus raw socket escape attempts | Hardened sandbox profiles, container filesystem isolation, syscall policy, package-install controls, and identity-bound execution attestations |
| Artifact substitution | Submitted source differs from the trace or receipt the benchmark evaluates | `outputs/submitted_artifact_runner_report.md` binds fixture artifact source SHA-256, emitted trace id, broker attestation id, and sandboxed execution attestation id into keyed-integrity-tagged receipts (HMAC-SHA256, public fixture key) | Identity-bound submitter signatures, transparency log, and reproducible submitted-artifact packaging |
| Artifact sandbox escape | Submitted artifact writes outside its workspace, reads host secrets, or opens direct network egress | `outputs/submitted_artifact_runner_report.md` probes a Docker profile for network-none denial, read-only workspace/root filesystem denial, controlled environment, dropped capabilities, and no-new-privileges | Seccomp/AppArmor policy, package-install controls, filesystem allowlists, IPC controls, side-channel analysis, and production broker integration |
| Tool-call exfiltration | Tool adapter uploads raw context while final answer looks safe | `outputs/tool_trace_report.md` records expected and observed tool-call outcomes | Real tool broker with network policy and per-call attestations |
| Aggregate linkage | Aggregate contribution reveals a rare or identifying pattern | `outputs/aggregate_risk_report.md` gates aggregate candidates by synthetic linkability risk; `outputs/aggregate_attack_report.md` adds rare-cohort, auxiliary-context, and differencing pressure; `outputs/aggregate_empirical_attack_report.md` simulates synthetic cohort uniqueness; `outputs/executable_aggregate_attack_report.md` executes differencing, linkage, and small-cell attacks against deterministic fixtures; `outputs/aggregate_privacy_challenge_report.md` compares naive and controlled target inference over semi-realistic synthetic microdata | Attacks against realistic consented fixtures, differential privacy accounting |
| False external validation | Seed annotations or baselines are mistaken for independent review | `outputs/annotation_agreement_report.md` and `outputs/baseline_submission_report.md` preserve seed-only blockers | Independent reviewer identity process and public baseline submission review |
| Annotation leakage | Blind packet reveals automated scores, run ids, agent ids, or sampling strata | `outputs/annotation_packet_v2.md`, `schemas/annotation-packet-v2.schema.json`, and `tests/annotationV2.test.ts` forbid those fields in reviewer packets | Independent annotation operations with reviewer identity controls and private label custody |

## Residual Risks

- The current UI is not an authenticated product.
- The policy engine is not formally verified.
- The benchmark uses synthetic fixtures.
- There is no secure local storage layer yet.
- The egress guard and storage-backed fetch mediation are application-level controls; the in-process/preload egress guard is advisory (a monkey-patch) and bypassable via `child_process` and UDP/dgram, so it does not provide OS-enforced containment; the macOS sandbox and Docker network-none probes are real confinement evidence for specific child/container paths, not a complete production confinement system.
- Broker attestations use a deterministic fixture key and replay submitted trace claims; they are not production broker execution, legal non-repudiation, or identity-bound third-party attestations.
- Sandboxed runner attestations execute broker-approved fixture traces in a guarded child process and deny two escape paths; they are still not a production sandbox, package isolation boundary, or arbitrary third-party-code execution service.
- Submitted artifact receipts execute checked-in fixture artifacts and bind source digests to emitted traces; they are not independent external submissions, identity-bound receipts, or production sandbox guarantees.
- Unless explicitly routed through the Docker hardened profile, the submitted-artifact runner executes untrusted entrypoints as an unsandboxed host Node process with full network and filesystem access; the in-process egress guard is advisory and bypassable, so it must not be relied on as OS-enforced isolation.
- Tool-call traces use deterministic in-process adapters, not real business APIs or network controls.
- Aggregate-risk, aggregate-attack, synthetic cohort, executable aggregate, and aggregate privacy challenge probes are synthetic and do not prove non-reconstructability.
- Canary SLR is an objective marker test, not a complete semantic leakage or side-channel detector.
- Seed annotation and baseline files prove the intake pipeline works; they do not prove external validation.
- There is no full real model prompt-injection test suite yet.

These limitations are intentional to document the line between this public research artifact and a production personal-agent platform.
