# Citation And Reproducibility Checklist

This checklist separates what a reviewer can reproduce locally from what still requires outside validation.

## Citation

- Use `CITATION.cff` as the canonical citation metadata.
- Cite the GitHub repository URL and commit SHA used for any result.
- If a future DOI is minted, cite the DOI and keep the commit SHA in the benchmark report.
- Do not cite PAISL as a validated benchmark standard until independent annotation, strong baseline, and public-review evidence exist.

## Local Reproduction

| Gate | Command | Expected Evidence |
| --- | --- | --- |
| Install | `pnpm install` | Locked dependency graph from `pnpm-lock.yaml` |
| Core verification | `pnpm verify` | Eval outputs, artifact manifest, tests, and build pass |
| Submitted artifacts | `pnpm submitted:runner` | Source-digest-bound receipts, broker attestations, and sandbox attestations |
| Artifact bundles | `pnpm artifact:bundles` | Valid bundles pass and malformed bundle is rejected |
| Runner hardening | `pnpm runner:hardening` | Escape-corpus probes and explicit limitations |
| macOS confinement | `pnpm confinement:probe` | Unsandboxed positive control succeeds and sandboxed network access is denied |
| Docker confinement | `pnpm confinement:container` | Normal container reaches host service and `--network none` fails |
| Artifact integrity | `pnpm artifact:manifest && pnpm artifact:verify` | Public artifact SHA-256 manifest matches the checkout |

## Paper Package

- Paper-style draft: `paper/personal_ai_sovereignty_benchmark.md`
- Benchmark release card: `outputs/benchmark_release_card.md`
- System-card-inspired disclosure: `outputs/system_card.md`
- Generated figures and tables: `outputs/figures_and_tables.md`
- Claim evidence index: `docs/claim_evidence_index.md`
- Falsification criteria: `docs/falsification_criteria.md`

## Required Environment Notes

- Node and pnpm versions should match `package.json` and the lockfile.
- Docker is required for container confinement and submitted-artifact hardening probes.
- macOS sandbox probes require macOS and may be unavailable on Linux.
- Local-model transcript evaluation is optional and environment-dependent.

## Evidence That Must Not Be Inferred

- Passing local tests does not prove independent validation.
- Passing Docker or process probes does not prove production sandboxing.
- Fixture HMAC signatures do not prove production key custody.
- Aggregate attack reports do not prove differential privacy.
- A Hugging Face-ready folder does not mean the dataset or Space has been published.
