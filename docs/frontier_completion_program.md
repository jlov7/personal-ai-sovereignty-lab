# Roadmap to External Validation

This document defines the remaining work surface for moving Personal AI Sovereignty Lab (PAISL) toward frontier-grade credibility without pretending external evidence already exists. It separates work that is controllable locally from the parts that genuinely require outside reviewers, credentials, or third-party systems.

The honest distance to frontier-grade credibility is not mostly code polish; it is evidence quality. Local work can make the scaffold reproducible, tamper-evident, and reviewable. It cannot manufacture the independent annotation, strong external baselines, and public critique that a validated benchmark requires.

## Current Position

- Current standing: a credible benchmark scaffold and evaluation harness with strong local evidence and no independent validation yet (described qualitatively, not with a self-assigned number).
- Current evidence class: executable deterministic benchmark scaffold with submitted-artifact fixture execution, artifact-bundle verification, local transparency-ledger probes, runner escape-corpus probes, metric calibration and ablation reports, scenario provenance/split/mutation evidence, baseline leaderboard gates, broker/sandbox attestations, Docker profile probes, synthetic aggregate attacks, local-model evidence, and GitHub Actions evidence.
- Current non-claim: this is not a validated benchmark standard, not production privacy infrastructure, and not externally calibrated.

## What Frontier-Grade Requires

| Requirement | Current State | Locally Controllable? | Blocking Condition |
| --- | --- | --- | --- |
| Independent annotation | Seed annotation only | Prepare tooling only | Need independent reviewers |
| Inter-rater agreement | Pipeline exists, insufficient data | Prepare and document only | Need overlapping reviewer labels |
| Strong external baselines | Author fixtures and local models | Build intake and fixture adapters | Need independent/system submissions |
| Production broker execution | Deterministic broker replay | Build stronger local prototype | Need real deployment/security review |
| Production key custody | Fixture HMAC keys and lifecycle probes | Build semantics and docs | Need real user-held/KMS/HSM custody |
| Production sandboxing | Child process, macOS/Docker probes, fixture artifact runner | Harden local profile and verifier | Need production isolation and adversarial review |
| Real-data privacy attacks | Synthetic/semi-realistic fixtures | Build stronger synthetic challenges | Need consented realistic data and privacy review |
| Hugging Face/public dataset | Package prepared | Prepare fully | Need maintainer token/publication |
| Community validation | Public issues exist | Improve process | Need outside participation |
| Paper/preprint legitimacy | Technical memo exists | Draft stronger paper package | Need venue/reviewer feedback |

## Work by Track

Each track lists the work that has been completed locally and the external blocker that remains.

### Track A: Submitted Artifact Standard

Goal: make artifact submissions reproducible, tamper-evident, and reviewable enough that outside systems can eventually submit baselines.

Status: locally implemented for 1.0.0-rc.0, carrying forward v0.18 Track A evidence. External independent submissions remain blocked.

Locally controllable work:

- [x] Define an artifact bundle schema with manifest, entrypoint, scenario coverage, runtime constraints, source digests, expected outputs, and claim boundaries.
- [x] Add a bundle verifier that rejects missing files, digest mismatches, unpinned runtime metadata, unexpected writes, and missing claim boundaries.
- [x] Add a transparency-ledger report that chains submitted artifact receipts and detects tampering.
- [x] Add public issue templates for artifact baseline submissions and runner escape reports.
- [x] Add seed safe, unsafe, and malformed bundle fixtures with tests.

External blocker:

- Independent systems must submit real bundles before this becomes baseline evidence.

### Track B: Runner Hardening

Goal: make the local runner much harder to dismiss as a toy process wrapper.

Status: locally implemented for 1.0.0-rc.0, carrying forward v0.18 Track B evidence. Production sandboxing and adversarial security review remain external blockers.

Locally controllable work:

- [x] Add an explicit Docker profile contract covering network, filesystem, environment, process, package-install, and resource controls.
- [x] Add probes for package-install attempts, child-process spawning, filesystem exfiltration channels, writable mounts, env leakage, DNS behavior under network-none, and IPC assumptions.
- [x] Add seccomp/AppArmor policy documentation and, where portable in CI, policy probes or static validation.
- [x] Add a runner escape corpus with expected denials and limitation labels.

External blocker:

- Production multi-tenant sandboxing requires security review and adversarial testing outside the fixture runner.

### Track C: Measurement Validity

Goal: reduce the criticism that the scorecard is only the author's preferences encoded in TypeScript.

Status: locally implemented for 1.0.0-rc.0, carrying forward v0.18 Track C evidence. Independent reviewer calibration remains externally blocked.

Locally controllable work:

- [x] Add a label calibration packet that maps each metric to observable evidence.
- [x] Add disagreement templates and adjudication rules.
- [x] Add synthetic annotator sanity checks that do not count as validation but verify the agreement pipeline math.
- [x] Add metric-ablation reports showing how scores change when privacy, usefulness, autonomy, and consent weights are varied.
- [x] Add scenario difficulty and ambiguity tags with coverage reports.

External blocker:

- Real calibration requires independent reviewers and overlapping labels.

### Track D: Scenario Provenance and Splits

Goal: make the scenario set feel benchmark-grade rather than hand-authored examples.

Status: locally implemented for 1.0.0-rc.0, carrying forward v0.18 Track D evidence. Independent scenario authorship and private hidden split operation remain external blockers.

Locally controllable work:

- [x] Add scenario provenance metadata: author, domain, sensitivity, intended failure modes, ambiguity level, and split.
- [x] Define public/dev/eval/hidden split mechanics without including hidden answers.
- [x] Add scenario mutation tests for consent confusion, authority pressure, urgency pressure, and minimization ambiguity.
- [x] Add a scenario contribution rubric and rejection criteria.

External blocker:

- Independent scenario authorship and hidden split maintenance require outside contributors or private maintainer work.

### Track E: Aggregate Privacy Attacks

Goal: strengthen aggregate-release evaluation without claiming formal DP.

Status: locally implemented for 1.0.0-rc.0, carrying forward v0.18 Track E evidence. Real-data attacks and formal privacy accounting remain external blockers.

Locally controllable work:

- [x] Add more attack families: membership inference, attribute inference, differencing over repeated releases, rare cohort joins, threshold attacks, and noisy-release sensitivity.
- [x] Add a privacy-accounting explainer and explicit non-DP labels.
- [x] Add attack cards for each aggregate scenario.
- [x] Add report fields for attack preconditions and why synthetic success/failure may not transfer.

External blocker:

- Real-data attacks require consented realistic data and privacy review.

### Track F: Baseline Coverage

Goal: make baseline absence impossible to miss and easy to remedy.

Status: locally implemented for 1.0.0-rc.0, carrying forward v0.18 Track F evidence. Strong cloud/frontier and production personal-agent baselines remain external blockers.

Locally controllable work:

- [x] Add runnable baseline adapters for deterministic centralized, local-only, brokered-tool, and submitted-artifact agents.
- [x] Add a baseline leaderboard schema that is blocked until external submissions exist.
- [x] Add local OpenAI-compatible artifact wrapper documentation for maintainers with local models.
- [x] Add "strong baseline required" gates to release reports.

External blocker:

- Strong cloud/frontier and production personal-agent baselines require credentials, policies, or external submitters.

### Track G: Consent and Key Custody

Goal: separate consent semantics from production cryptographic custody.

Status: locally implemented for 1.0.0-rc.0, carrying forward v0.18 Track G evidence. Production custody requires real key storage, recovery, and legal/security review.

Locally controllable work:

- [x] Add explicit user-held key, device key, and broker key threat-model variants.
- [x] Add recovery/rotation compromise scenarios.
- [x] Add deterministic custody attack probes for replayed receipts, stale keys, confused deputy flows, and cross-scenario receipt reuse.
- [x] Add a production custody design note with non-claims.

External blocker:

- Production custody requires real key storage, recovery, and legal/security review.

### Track H: Public Release and Review

Goal: make the public repo easy for serious outsiders to critique.

Status: locally implemented for 1.0.0-rc.0, carrying forward v0.18 Track H evidence. Public critique and adoption remain external blockers.

Locally controllable work:

- [x] Add issue forms for baseline bundle submission, annotation submission, scenario criticism, aggregate attack reports, runner escape reports, and scorecard disputes.
- [x] Add a release evidence index that maps claims to artifacts and workflows.
- [x] Add a "what would falsify this benchmark" document.
- [x] Prepare Hugging Face/Space material so only credentials remain.

External blocker:

- Public validation requires real outside review, publication credentials, and community participation.

### Track I: Paper Package

Goal: make the project legible as a research program.

Status: locally implemented for 1.0.0-rc.0, carrying forward v0.18 Track I evidence. Preprint/workshop legitimacy remains externally blocked.

Locally controllable work:

- [x] Convert the technical memo into a paper-style draft with abstract, related work, method, benchmark object, threat model, experiments, limitations, and roadmap.
- [x] Add benchmark cards and system-card-inspired release cards.
- [x] Add citation and reproducibility checklist.
- [x] Add figures/tables generated from current artifacts.

External blocker:

- A credible preprint/workshop claim requires external feedback and likely additional baselines.

## Implementation Order

The tracks were implemented in this order:

1. Track A: artifact bundle standard, verifier, transparency ledger.
2. Track B: runner escape corpus and hardened profile probes.
3. Track C: measurement-validity calibration packet and ablations.
4. Track D: scenario provenance, split mechanics, mutation tests.
5. Track E: stronger aggregate privacy attack families.
6. Track F: baseline leaderboard and runnable baseline adapters.
7. Track G: custody attack probes and production design note.
8. Track H: public review issue forms and claim-evidence index.
9. Track I: paper package.

## Credibility Expectations

This roadmap should not be used to overclaim. The project is not graded with a self-assigned number.

- Tracks A and B improve local execution and security evidence.
- Tracks C through I improve local credibility, but a frontier-grade claim honestly requires external annotations and strong independent baselines.
- Full frontier-grade credibility is blocked until the benchmark survives public review, independent reproduction, real submitted systems, and realistic privacy/security attacks.

## Scope of Local Work

The locally controllable work is complete when:

- every track above has an implemented artifact or a documented external blocker;
- `pnpm verify`, `pnpm submitted:runner`, confinement probes, dependency audit, secret scan, and GitHub Actions pass;
- `outputs/frontier_audit.md`, `docs/frontier_100_bar.md`, and `outputs/public_validation_report.md` agree;
- the only open blockers require independent reviewers, credentials, third-party systems, or production deployment.
