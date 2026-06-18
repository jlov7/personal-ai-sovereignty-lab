# Scenario Contamination Policy

PAISL separates three scenario surfaces:

- The curated scoring suite: 51 synthetic scenarios used for the historical 91.06 reference-policy score lineage.
- The generated public corpus: 400 deterministic scenarios committed under `src/scenarios/generated/`, produced by `pnpm scenarios:generate --seed 20260611 --count 400`.
- The held-out seed file: `private/holdout_seeds.json`, which is gitignored and represented publicly only by `outputs/holdout_commitment.json`.

## Commitment Scheme

The public commitment records:

- SHA-256 of the private seed file bytes.
- Number of held-out seeds.
- Generator version.
- SHA-256 of `src/generator/grammar.ts`.

This proves that a private seed file existed for the committed generator grammar without revealing the seeds.

## Rotation Rule

When a held-out batch is used for a public result, the maintainer must:

1. Reveal the seed file used for that result.
2. Archive the generated held-out scenarios and results with the report.
3. Create a new private seed file.
4. Commit a new `outputs/holdout_commitment.json` before running further held-out evaluations.

## Limitations

The generated scenarios are templated synthetic fixtures. The grammar is public, so an evaluator can train against the distribution even when exact held-out seeds are private. The commitment reduces exact-case leakage; it does not make the benchmark immune to contamination, memorization, or distribution-level overfitting.

The generated public corpus is useful for coverage and regression pressure. It is not independent validation, not a real-user sample, and not evidence that PAISL is a standard.
