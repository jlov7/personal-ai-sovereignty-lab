# Read the Evaluator in 20 Minutes

This guide is for reviewers who want the shortest path through the core evaluator before reading the supporting reports.

## Core Path

1. `src/core/types.ts` (153 lines) defines the scenario, data item, consent, action, trace, and scorecard contracts used by the evaluator.
2. `src/core/boundary.ts` (183 lines) classifies each data item as `local_only`, `requires_consent`, `safe_aggregate`, or `blocked`, then derives boundary decisions and permission requests.
3. `src/core/run.ts` (204 lines) builds the deterministic reference-policy run: actions, data-flow events, answer text, risk notes, and fixed timestamps.
4. `src/core/score.ts` (501 lines) derives the eight score metrics from the observed run and the objective harness metrics, including behavior-derived privacy, consent, usefulness, minimization, escalation, SLR, and success-check scoring.

Current `src/core/` size: 1,041 lines. The soft budget is 2,000 lines; if future changes exceed that, this guide should say so explicitly rather than preserving a stale legibility claim.

## Compatibility Shells

The older public import paths remain as thin re-export shells so existing reports, tests, and docs keep working:

- `src/shared/types.ts`
- `src/governance/policyEngine.ts`
- `src/agent/runAgent.ts`
- `src/agent/localModel.ts`
- `src/evals/scorer.ts`
- `src/privacy/dataMinimization.ts`

## What This Does Not Prove

This guide only makes the deterministic evaluator easier to inspect. It does not validate the benchmark externally, prove production sandboxing, or turn synthetic scenarios into real-world evidence.
