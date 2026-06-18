# Frontier-Grade Bar

This document defines the bar for calling Personal AI Sovereignty Lab (PAISL) genuinely frontier-grade. It deliberately does not grade the project with a number.

## Correction

We no longer assign ourselves a numeric score against this bar. Earlier versions of this document carried self-assigned scores; those have been removed because grading our own work with a number invites exactly the overclaiming this bar is meant to prevent.

Against the stricter bar below, the current project is a credible local benchmark scaffold and evaluation harness with strong local evidence, not a finished or independently validated frontier-grade benchmark.

## What Frontier-Grade Means

A frontier-grade benchmark would be credible even if reviewed by people who have built frontier model training, eval, safety, and deployment systems. It would not rely on taste, polish, or narrative. It would survive because the evidence is hard to dismiss.

Required properties:

1. **Non-trivial research contribution**
   - The benchmark must define a problem that is not already covered by existing evals.
   - The novelty must be operational, not rhetorical: new task object, new scoring target, new failure taxonomy, or new measurement method.

2. **Measurement validity**
   - Metrics must be justified as measuring the intended construct.
   - Scores must not be arbitrary weighted heuristics unless explicitly framed as provisional.
   - Human labels, policy-oracle labels, and model outcomes must be compared.

3. **Scenario/data quality**
   - Scenarios must be numerous, diverse, versioned, and difficult enough to reveal real failures.
   - Tasks need adversarial variants, ambiguous edge cases, consent-confusion cases, and negative controls.
   - Synthetic scenarios must be labeled synthetic; real or semi-real data must have provenance and privacy review.

4. **Strong baselines**
   - The benchmark must evaluate multiple systems: strong local models, cloud models when permissible, tool-using agents, local-only agents, centralized agents, and hybrid agents.
   - Weak baselines are useful, but frontier-grade credibility requires at least one strong baseline that can plausibly pass many cases.

5. **Independent annotation**
   - At least three independent reviewers must label overlapping cases.
   - Inter-rater agreement must be computed and interpreted.
   - Disagreements must be preserved and used to refine the rubric.

6. **Statistical rigor**
   - Results need confidence intervals, bootstrap estimates, or another uncertainty treatment.
   - Benchmark-size limits must be quantified.
   - Score sensitivity to weighting choices must be tested.

7. **Security/privacy depth**
   - Threat model must include attacker capabilities, data flows, reconstruction risks, consent receipt failure modes, tool-call risks, egress controls, and retention/revocation.
   - Claims must distinguish policy simulation from actual enforcement.

8. **Reproducibility**
   - One command should reproduce core outputs.
   - Environment constraints, model versions, seeds, and generated artifacts must be recorded.
   - CI should run schema, unit, build, and artifact-drift gates.

9. **Public benchmark hygiene**
   - Clear license, citation file, contribution guide, benchmark card, versioning policy, changelog, and issue templates.
   - Hugging Face-ready dataset or Space packaging if that is the target venue.

10. **Research communication**
    - The technical memo should read like the seed of a workshop paper or system card, with claims bounded by evidence.
    - Limitations should be specific enough that a skeptical reviewer can see the author understands the weaknesses.

## Frontier Rubric

| Category | Frontier Standard |
| --- | --- |
| Research novelty and strategic importance | Defines a clearly missing benchmark object and motivates it with crisp, falsifiable claims. |
| Measurement validity | Metrics are justified, calibrated, and compared against human judgment and policy-oracle labels. |
| Scenario and data quality | Broad, hard, versioned scenarios with adversarial variants and provenance. |
| Baseline/model coverage | Multiple strong and weak systems, including real tool-using agents where applicable. |
| Reproducibility engineering | One-command regeneration, CI gates, pinned environment, artifact drift checks. |
| Statistical rigor | Uncertainty, sensitivity analysis, and score robustness are reported. |
| Privacy/security depth | Threat model maps actual enforcement, not only simulated policy decisions. |
| Software quality | Clean typed implementation, maintainable harness, no brittle hidden state. |
| Product/reviewer clarity | UI and reports make the benchmark understandable without hiding technical detail. |
| Public release credibility | License, citation, contribution workflow, release artifacts, and external-review readiness. |

## Where The Project Stands

We describe the project qualitatively rather than with a number. PAISL is a credible benchmark scaffold and evaluation harness with strong local evidence and no independent validation yet.

What is locally strong: a transparent, behaviour-derived scoring path; 51 synthetic scenarios with adversarial variants, provenance metadata, split assignment, and mutation families; deterministic baselines plus a real reproducible local-model sweep (`gemma4:26b`, `qwen3:4b`, `llama3.2:3b`); a tamper-evident consent-ledger hash chain; keyed-integrity tags on receipts and attestations (HMAC-SHA256 under a public fixture key, providing integrity/tamper-evidence but not authenticity); one-command hermetic regeneration; CI schema/unit/build/drift gates; aggregate-attack and confinement-probe harnesses; and a typed, test-covered implementation.

What is not yet established, and blocks any frontier-grade claim:

- independent annotation (multiple outside reviewers labelling overlapping cases, with inter-rater agreement);
- independent scenario authorship and outside provenance review;
- production-grade tool-using agent baselines (and a capable cloud or frontier-adjacent model run where permitted);
- real aggregate attacks against consented, realistic data rather than synthetic fixtures;
- formal privacy accounting;
- production key custody (real storage, recovery, user-held signing);
- production broker execution rather than deterministic fixture replay;
- custom seccomp/AppArmor enforcement rather than observed local Docker behaviour;
- a public append-only transparency service rather than a local ledger;
- outside critique that we have accepted and acted on.

Until that evidence arrives, the honest summary is: a strong local scaffold, scientifically unvalidated.

## Evidence Milestones

These are qualitative milestones, not self-assigned scores.

### Stronger local evidence

- At least one major local evidence class beyond replay-only fixtures, such as broker-gated child-process execution with escape-attempt negative controls.
- Clear machine-readable separation between policy claims, broker replay, and guarded execution evidence.
- Public CI and release evidence for the new local evidence class.
- Remaining external blockers must still be explicit: independent annotation, stronger baselines, Hugging Face publication, and real-data privacy attacks.

### Approaching frontier-grade

- Inter-rater agreement computed over enough overlapping cases to make the scoring rubric auditable.
- Strong baselines include at least one production-grade tool-using agent and one capable cloud or frontier-adjacent model where allowed.
- Human-label uncertainty and benchmark-size justification are included in the statistical report.
- External scenario contributions and rejected cases are documented.
- Runtime enforcement includes a credible OS/network boundary experiment or a clear integration with a sandboxed egress layer.

### Fully frontier-grade

- Public external review loop with visible issues or pull requests.
- Accepted workshop/preprint-style memo or serious community discussion.
- Strong baselines and ablations showing the benchmark catches meaningful system differences.
- Security/privacy analysis with empirical attacks, formal-ish privacy accounting where relevant, and actual enforcement experiments that are not just application-level simulations.
- Clear evidence that other technically sophisticated people can reproduce, critique, extend, and find flaws in the benchmark.
