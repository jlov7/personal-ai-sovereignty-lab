# Comparative Analysis

This benchmark is deliberately positioned between several existing traditions.

## Existing AI Eval Harnesses

OpenAI Evals is an open-source framework and benchmark registry for evaluating LLMs and LLM systems. Its lesson for this repo is that eval logic and data should be runnable and inspectable, not just described in prose. Personal-agent sovereignty evals inherit that expectation: a claim about privacy or autonomy is weak unless the trace can be regenerated.

EleutherAI's `lm-evaluation-harness` established a practical pattern for model/task abstraction, reproducible task definitions, and logged samples. The lesson here is schema discipline: a benchmark should make it easy to add tasks without changing the entire harness.

Stanford HELM is the clearest precedent for holistic evaluation. HELM explicitly frames evaluation as scenarios plus metrics, and emphasizes transparency, standardized conditions, and a living benchmark model. This repo adopts that shape but changes the target: from language-model capability to personal-agent sovereignty behavior. The direct analogy is:

```text
HELM: model + scenario + metric -> capability/risk result
PAISL: agent + scenario + data boundary + consent state + metric -> sovereignty result
```

## Model Cards and System Cards

Model cards introduced a compact documentation pattern for intended use, evaluation conditions, limitations, and performance. System cards extend the same spirit to deployed systems, safety mitigations, and risk evaluation.

This repo uses a benchmark card because the artifact is not only a model and not yet a deployed system. The card documents intended use, non-use, scenario coverage, metrics, limitations, and research questions. A benchmark card should make overclaiming harder: the card has to say what the benchmark cannot prove.

The newer release artifacts also borrow from system-card practice: the tool-trace report and aggregate-risk report expose control points that a final answer alone would hide.

## Local-First Software

Local-first software argues that users should retain ownership and control even when cloud services are useful. This benchmark translates that principle into agent evals: raw context starts local, network escalation is optional, and user-control alignment is measurable. The three-layer architecture is a benchmarkable version of that principle:

| Local-first ideal | Benchmark translation |
| --- | --- |
| Network optional | Useful work should begin in Layer 1 |
| Security and privacy by default | Sensitive raw data defaults to `local_only` or `blocked` |
| User ownership and control | Boundary crossing requires visible consent or a safe aggregate |

## Privacy-Preserving ML

Federated learning and differential privacy are useful inspirations, but the current scaffold does not claim formal privacy guarantees. The benchmark uses a weaker but inspectable standard first: data minimization, aggregate-only sharing, explicit consent, blocked releases, and synthetic linkability probes. Future versions should add empirical reconstruction tests, privacy budgets with formal parameters, and attack evaluations. The current goal is to make privacy-relevant behavior visible before pretending it is mathematically solved.

## Agent Safety and Autonomy Boundaries

Agent systems create risks beyond text generation because they can browse, use tools, call APIs, and act on behalf of users. Personal-agent sovereignty requires autonomy boundaries: advise, draft for review, act only with consent, and refuse when action would expose sensitive user leverage or regulated data.

The benchmark therefore scores autonomy separately from usefulness. An agent that completes the task by contacting a provider without consent should not receive a high sovereignty score.

The executable tool traces make this testable: local search, consented tool calls, aggregate submission, and unsafe raw-egress attempts are represented as auditable events instead of being inferred from prose.

## Enterprise AI Governance

Enterprise governance frameworks emphasize mapping, measuring, managing, and governing AI risk. This benchmark makes those verbs concrete for personal agents: map data assets and actors, measure score dimensions, manage consent/blocks, and govern outputs with traceable policy tags.

| Governance function | Benchmark artifact |
| --- | --- |
| Map | Scenario schema and threat-model schema |
| Measure | Scoring schema and generated scorecard |
| Manage | Consent gates, egress probes, tool traces, aggregate-risk gates, blocks, and improvement notes |
| Govern | Benchmark card, release packet, limitations, and policy tags |

## Gap This Repo Fills

Most eval harnesses ask whether a model answered correctly. This benchmark asks whether a personal-agent system answered usefully while respecting the user's data boundary, consent posture, autonomy constraints, and long-term control.
