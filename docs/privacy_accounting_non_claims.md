# Privacy Accounting Non-Claims

Status: local aggregate-risk scaffold, not a differential privacy guarantee.

PAISL now includes aggregate attack families for membership inference, attribute inference, repeated-release differencing, rare-cohort joins, threshold attacks, and noisy-release sensitivity. These are useful benchmark pressure tests because they force every "safe aggregate" claim to name an attacker, a release shape, and a missing control.

They are not formal privacy accounting.

## Current Accounting Label

- Label: `not_differential_privacy`
- Unit: `synthetic_risk_points`
- Formal epsilon: not provided
- Formal delta: not provided
- Composition accounting: not provided
- Real data attack validation: not provided

The current reports use deterministic scenario metadata, synthetic cohorts, and fixture release shapes. A high score means "this aggregate candidate is attack-shaped and should be controlled or blocked." A low score does not mean privacy is proven.

## What Would Be Required For A DP Claim

A future version would need:

- a defined adjacency relation for each release mechanism;
- a concrete mechanism with calibrated noise;
- epsilon/delta accounting and composition across repeated releases;
- public implementation tests for clipping, noise generation, and release suppression;
- review by people with privacy-preserving ML or statistical disclosure-control expertise;
- consented realistic data or a defensible public benchmark substitute.

Until then, the correct claim is narrower: PAISL has executable and heuristic aggregate-privacy attack scaffolding that makes unsafe aggregate releases easier to find before public validation.
