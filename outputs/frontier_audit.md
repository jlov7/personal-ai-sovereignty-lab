# Frontier-Grade Self-Assessment

This is a candid self-assessment of where PAISL stands against the bar of a
benchmark that would survive hostile review by senior evaluation researchers and
frontier-lab engineers. It deliberately carries **no numeric self-score** — a
self-awarded "X/100" is not evidence, and the defining property of a frontier
benchmark is that it survives *outside* review, which has not happened yet.

## Honest standing

PAISL is a strong, runnable, reproducible **benchmark scaffold and public
validation candidate** — not a validated benchmark. What is genuinely solid:

- Deterministic, hermetic evaluation; scores derived from the actual data flow
  (sensitivity x layer x released form x consent), not self-reported labels.
- A real, reproducible local-model sweep (gemma4:26b, qwen3:4b, llama3.2:3b)
  with honest framing of small-model structured-output failures.
- Machine-readable schema contracts, a verifiable consent hash chain, keyed-
  integrity receipts (honestly labelled as integrity, not authenticity), and a
  full quality gate (`pnpm verify`).

## The hardest critique (and it is fair)

> This is a thoughtful benchmark proposal and an unusually well-packaged scaffold
> with good local evidence — but it is not yet a validated benchmark. The data is
> synthetic, independent human validation is absent, the strongest model/tool
> baselines are missing, aggregate-privacy safety is tested only against
> deterministic fixtures, and simulated enforcement must not be confused with
> deployed privacy guarantees.

## What would close the gap (requires people, not more code)

- Independent annotation by multiple reviewers and independently authored
  scenarios with a maintained hidden split.
- Production tool-using agent baselines submitted by outside parties.
- Empirical aggregate attacks against realistic consented data, and formal
  privacy accounting rather than non-DP labels.
- Production key custody and OS/kernel-enforced egress, not fixture keys and an
  advisory in-process guard.
- A public, append-only transparency service and genuine outside critique.

Until those exist, the correct public claim is exactly: *a strong local-first
benchmark scaffold and public validation candidate* — not a validated or
"frontier" benchmark.
