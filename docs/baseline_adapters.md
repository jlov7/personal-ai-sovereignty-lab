# Baseline Adapters

Status: runnable local adapters plus external-baseline requirements.

PAISL treats baselines as evidence, not decoration. A benchmark cannot be credible if the only systems it compares against are author-controlled references. The current repo therefore separates local seed adapters from the strong external baselines required for validation claims.

## Runnable Local Adapters

These adapters run through `pnpm eval`:

- `sovereign_hybrid`: deterministic reference policy agent.
- `brokered_tool_agent`: deterministic tool-using agent with consent receipts and egress checks.
- `centralized_cloud`: negative control that collapses data boundaries.
- `local_only`: negative control that preserves privacy by refusing useful escalation.

The submitted-artifact fixture adapter runs through:

```bash
pnpm submitted:runner
```

It executes checked-in artifact fixtures, signs submission receipts, preserves broker/sandbox attestations, and probes the Docker runner profile. Its pass rate is not comparable to benchmark scorecard averages.

## OpenAI-Compatible Local Wrapper Path

Maintainers can wrap a local OpenAI-compatible endpoint, such as an Ollama or LM Studio server, into the submitted-artifact contract. The wrapper should read only the scenario payload it is given, emit an external-agent trace, and bind that trace to an artifact bundle.

Expected environment variables:

- `OPENAI_BASE_URL`: local endpoint, for example `http://127.0.0.1:11434/v1`.
- `OPENAI_API_KEY`: local placeholder or real key if the endpoint requires one.
- `PAISL_BASELINE_MODEL`: model name to call.

This wrapper path is intentionally documented but not checked in with live credentials or a required network dependency. Results produced by a maintainer-run wrapper remain local evidence until independently submitted with trace artifacts, bundle metadata, and claim boundaries.

## Harness Model Sweeps

`pnpm harness:model` runs the canary harness against local OpenAI-compatible endpoints when `PAISL_MODEL_BASE_URL` and `PAISL_MODEL_NAMES` are set. With no endpoint configured it exits without writing files, so the default install, test, eval, and CI paths remain offline and free.

`pnpm harness:model:write` writes platform-tagged harness run records under `outputs/harness_model_runs/` for maintainers or contributors who deliberately run a local model. Remote model providers are blocked unless `PAISL_REMOTE_EVAL=1`, the provider credential exists, `--i-am-spending-money` is present, `--max-runs <n>` is set, and confirmation is supplied. This keeps paid evidence out of accidental paths.

Submitted harness sweeps are checked locally by digest-binding each run record and recomputing canary leak findings from the submitted egress records. A transcript whose digest changes, or whose claimed leak findings cannot be reproduced by the local detector, is rejected.

Community-submitted harness sweeps should include the JSONL run records, model/runtime disclosure, scenario ids, decoding settings, endpoint type, and any limit/format failures. They should not include provider credentials, private prompts, real personal data, or paid-provider billing artifacts. Until those sweeps come from independent submitters, they remain local evidence rather than validation evidence.

## Strong Baseline Gate

The leaderboard remains blocked for validation claims until at least one independent production-grade or frontier-adjacent personal-agent baseline submits:

- scenario-level action traces;
- consent and data-flow evidence;
- artifact bundle metadata;
- runtime and network-policy disclosure;
- failure cases, not only final scores.

Weak local baselines are useful for regression testing. They are not enough to claim that PAISL is a validated public standard.
