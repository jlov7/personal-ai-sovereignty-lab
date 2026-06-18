# Personal AI Sovereignty Lab (PAISL)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/jlov7/personal-ai-sovereignty-lab/actions/workflows/ci.yml/badge.svg)](https://github.com/jlov7/personal-ai-sovereignty-lab/actions/workflows/ci.yml)
![Runs offline](https://img.shields.io/badge/runs-local-success)

A local-first benchmark scaffold and runnable demo for evaluating whether a personal AI agent stays useful while respecting the user's data boundaries.

PAISL asks a narrow question: when a personal agent touches raw local memory, private compute, external tools, and consent-based collective systems, can we inspect the whole run instead of only judging the final answer? The benchmark object is the run: scenario, data items, boundary decisions, consent state, tool trace, egress record, scorecard, and failure cases.

![PAISL local demo: scenario scorecard, data-boundary decisions, data-flow trace, tool-call trace, and the evaluation metrics](docs/assets/demo.png)

This is an honest scaffold, not a validated standard. Current scores come from deterministic fixtures and local evidence; independent annotation, external baselines, public scenario criticism, and stronger privacy/security review are still required. Start with [docs/known_limitations.md](docs/known_limitations.md), [docs/claim_evidence_index.md](docs/claim_evidence_index.md), and [docs/falsification_criteria.md](docs/falsification_criteria.md).

Version note: the public release candidate is `1.0.0-rc.0`. Some generated component reports retain `0.18.0` identifiers as historical evidence-lineage markers; they are not separate public release claims.

## Canary Mechanism

Protected data items receive deterministic non-secret canaries. Every non-local payload goes through an egress tap. If a protected marker crosses a disallowed boundary, the run fails the SLR check even if the model claims it behaved correctly.

```mermaid
flowchart LR
  User["User task and consent state"] --> Local["Local context and policy"]
  Local --> Canary["Canary-seeded protected data"]
  Canary --> Agent["Agent tool calls"]
  Agent --> Tap["Egress tap"]
  Tap --> Allowed["Allowed minimized payload"]
  Tap --> Leak["Disallowed canary finding"]
  Leak --> Score["Run scorecard"]
  Allowed --> Score
```

The detector catches verbatim and trivially encoded exfiltration. It does not claim semantic-leak detection, formal privacy guarantees, or production sandboxing.

## Boundary-Control View

The [sovereignty-usefulness report](outputs/sovereignty_frontier_report.md) plots two trace-derived checks from harness run records: task completion and boundary protection.

![Sovereignty-usefulness frontier plotting fixture controls and local-model evidence](outputs/figures/sovereignty_frontier.svg)

The chart is a control sanity check, not a leaderboard. Task completion means the mean share of objective success checks satisfied. Boundary score means one minus the confirmed raw-leak rate. The sparse shape is expected: zero-leak rows sit on the top edge, while the intentionally leaky negative control sits bottom-left. The single live-model row exists to exercise the reporting path, not to rank models.

## Run It

```bash
pnpm install
pnpm demo:leak   # malicious fixture; prints transcript, egress tap, caught canary, verdict
pnpm dev         # local Vite demo
pnpm verify      # eval + manifest + tests + production build
```

All default paths are local and credential-free. Real local-model sweeps are optional:

```bash
PAISL_MODEL_BASE_URL=<openai-compatible-local-url> \
PAISL_MODEL_NAMES=<model-name> \
PAISL_HARNESS_SCENARIO_IDS=all \
pnpm harness:model
```

Remote model adapters stay disabled unless the explicit spending gates in [docs/baseline_adapters.md](docs/baseline_adapters.md) are set.

## Evidence Spine

| Public claim | Current artifact-bound value |
| --- | ---: |
| Curated scored scenarios | 51 |
| Generated public scenarios | 400 |
| Public scenario records | 451 |
| Hermetic canary harness runs | 153 |
| Live local-model harness records | 1 |
| Blind annotation packet cases | 60 |
| Tiered attack scripts | 60 |
| Difficulty calibration runs | 60 |
| Reference-policy self-rubric average | 91.06 |

The reference-policy average is a self-rubric regression signal, not a benchmark result or model ranking. The committed local-model evidence is in [outputs/model_transcript_eval_multimodel.md](outputs/model_transcript_eval_multimodel.md), [outputs/adversarial_prompt_execution_multimodel.md](outputs/adversarial_prompt_execution_multimodel.md), [outputs/sovereignty_frontier_report.md](outputs/sovereignty_frontier_report.md), and [outputs/difficulty_calibration_report.md](outputs/difficulty_calibration_report.md).

## Positioning

| Existing pattern | What it contributes | What PAISL adds |
| --- | --- | --- |
| OpenAI Evals / lm-evaluation-harness | Runnable eval logic, task definitions, logged samples | Data-boundary decisions and consent gates as first-class scored outputs |
| Stanford HELM | Scenarios plus metrics under standardized conditions | Personal-agent scenarios where privacy and autonomy are scored alongside usefulness |
| Model cards / system cards | Intended use, limitations, evaluation disclosure | A benchmark card for agent sovereignty behavior |
| Local-first software | User ownership despite useful cloud layers | Layered local / private / federated agent evaluation |
| Enterprise AI governance | Risk mapping, controls, residual risk | Machine-readable threat-model schema and traceable policy tags |

## Architecture

| Layer | Role | Typical data |
| --- | --- | --- |
| Local intelligence | On-device reasoning over raw context | Notes, journals, financial records, private constraints |
| Personal/private compute | User-controlled compute after minimization or consent | Redacted summaries, capability indexes, approved drafts |
| Federated/collective | Aggregated learning or external agent interaction | Non-identifying aggregates, approved negotiation payloads |

See [docs/architecture.md](docs/architecture.md) and the reviewer path in [docs/reading_guide.md](docs/reading_guide.md).

## What Is Not Claimed

- No independent validation yet.
- No formal differential privacy.
- No production key custody, legal non-repudiation, or complete sandboxing.
- No real personal records in the scenario corpus.
- No claim that any model is safe for deployment as a personal agent.

Every schema contract, generated report, fixture, and public-review artifact is indexed in [ARTIFACTS.md](ARTIFACTS.md). The generated paper-style draft is [paper/personal_ai_sovereignty_benchmark.md](paper/personal_ai_sovereignty_benchmark.md), and the prepared Hugging Face package is in [huggingface/](huggingface/).

## License and Citation

MIT; see [LICENSE](LICENSE). To cite, use [CITATION.cff](CITATION.cff). Contributions and public review are welcome via [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

## Disclaimer

This is an independent personal research and development project. It is not affiliated with, endorsed by, or representative of any employer, client, or organization. "Lab" describes the scope of the work, not an institution.

The published evidence is intended to be judged from the checked-in artifacts and the reproducible `pnpm verify` gate.
