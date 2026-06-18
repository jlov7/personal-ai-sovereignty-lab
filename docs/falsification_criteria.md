# What Would Falsify This Benchmark

This project should be easy to criticize. A benchmark that cannot name its own failure conditions is not ready for serious review.

## Falsification Targets

| Target Claim | Falsifying Evidence | Required Response |
| --- | --- | --- |
| The benchmark measures user-sovereign personal-agent behavior. | Independent reviewers show that high scores can be achieved while ignoring consent, local-only boundaries, minimization, or user-control constraints. | Downgrade the benchmark claim, revise metrics, add negative controls, and rerun affected reports. |
| The scoring rubric is interpretable. | Reviewers cannot apply the rubric consistently, or inter-rater agreement remains low after adjudication rules are clarified. | Mark measurement validity as failed for that version and publish disagreement analysis. |
| The canary harness catches objective egress leaks. | A run moves a seeded protected marker to a disallowed non-local layer and no confirmed leak is recorded. | Treat as a scorer or tap bug, add the run as a regression fixture, and invalidate affected SLR/frontier claims. |
| The sovereignty-usefulness frontier is trace-derived. | A plotted point cannot be traced to committed harness run records, or status counts hide limit/format failures. | Regenerate the frontier from source records, remove unsupported points, and downgrade any stale README/paper claim. |
| Difficulty calibration supports the claimed saturation guard. | A stronger configured local model passes at or above the guard threshold, run records are stale or missing, or failures are mostly format artifacts rather than boundary behavior. | Mark the guard failed, add harder scripts or better adapters, and remove any claim that current attack difficulty is adequate. |
| The blind annotation packet supports outside validation. | Packet cases expose automated scores, leak findings, run ids, agent ids, sampling strata, or private annotator files. | Pull the packet, regenerate it blind, and block agreement reporting until labels are recollected. |
| Scenario coverage is meaningful. | External critics identify domain gaps, unrealistic tasks, duplicate cases, missing overreach modes, or boundary labels that invert the intended risk. | Accept scenario criticism, revise or remove cases, and record rejected/changed scenarios. |
| Baselines are sufficient for a validation claim. | A strong submitted system exposes that current deterministic baselines are too weak to calibrate difficulty. | Keep validation blocked until comparable strong baselines are added. |
| Aggregate releases are safe enough under the current controls. | Membership inference, attribute inference, differencing, rare-cohort joins, threshold attacks, or noisy-release sensitivity attacks recover sensitive facts under the stated assumptions. | Reclassify affected aggregate releases as blocked or requiring stronger controls. |
| Consent receipt checks prevent confused-deputy release. | Replayed, expired, stale-key, purpose-mismatched, cross-scenario, or wrong-audience receipts are accepted as valid. | Treat as a security bug, add regression tests, and invalidate affected release evidence. |
| Runner hardening prevents the claimed class of boundary failures. | A submitted artifact bypasses declared network, filesystem, environment, package-install, IPC, or receipt-integrity constraints inside the stated profile. | Publish the escape report, narrow the runner claim, and update the escape corpus. |
| Public validation has happened. | The evidence is only author-generated, seed-fixture, or maintainer-labeled. | Keep the project at candidate/scaffold status and block validation language. |
| Hugging Face release exists. | No public dataset or Space URL exists under a maintainer-controlled account. | State publication is prepared but blocked on credentials. |

## Red Lines

These conditions should trigger claim retraction, not soft wording.

- A report claims formal differential privacy without a defined mechanism, epsilon/delta, and composition accounting.
- A release claims independent validation using labels or baselines produced by the project author.
- A runner or broker report claims production sandboxing while using only fixture keys, local Docker probes, or preload instrumentation.
- Scenario documentation presents synthetic author-seed cases as real user data or independently authored hidden tasks.
- A credibility claim is justified by prettier documentation rather than stronger evidence.

## External Evidence Needed For A Frontier-Grade Claim

The project must not be described as frontier-grade or independently validated without at least these external inputs:

Inter-rater agreement must be computed over overlapping labels before any independent-validation claim is made.

1. Three or more independent reviewers labeling overlapping cases, with disagreement analysis.
2. At least one strong production-grade or frontier-adjacent personal-agent baseline submitted through the artifact or trace contract.
3. Public scenario criticism or independent scenario contributions, including rejected cases.
4. A realistic aggregate attack review or formal privacy-accounting contribution for any aggregate claim.
5. Public Hugging Face dataset or Space publication under maintainer credentials.

## Versioning Rule

Every accepted falsification should produce one of three outcomes:

1. A patch release that fixes the issue and preserves the failure as a regression test.
2. A claim downgrade in `README.md`, `outputs/frontier_audit.md`, and `docs/frontier_100_bar.md`.
3. A blocked validation gate in `outputs/public_validation_report.md`.

The project is more credible when it records failed claims than when it hides them.
