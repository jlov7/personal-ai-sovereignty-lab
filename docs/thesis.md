# Thesis

The dominant AI assistant pattern today is centralized: users disclose broad context to cloud systems, receive convenience in return, and usually cannot inspect the boundary decisions that happened along the way.

Personal AI should move in a different direction. The next durable layer is user-sovereign personal AI: agents that start from local intelligence, escalate only when useful, ask for consent when crossing boundaries, and expose enough telemetry for users and auditors to judge whether the system behaved appropriately.

The hard problem is not building another chatbot interface. The hard problem is designing agents that remain useful under real constraints:

- raw personal data should often remain on device
- private compute should receive minimized or user-approved payloads
- collective intelligence should operate on aggregates, consented data, or federated signals
- agents should refuse overreach even when doing so reduces short-term usefulness
- evaluation must score privacy, autonomy, and user control alongside task success

This repo demonstrates that thesis as an executable artifact. It models three compute layers, runs realistic personal-agent scenarios, records boundary decisions, evaluates every run with explicit rationales and failure cases, replays submitted action traces through a brokered attestation layer instead of trusting trace claims at face value, and executes broker-approved trace actions in a guarded child process with escape-attempt negative controls.

## Strategic Importance

Personal AI sovereignty matters because the value of future assistants will come from intimate context: memory, preferences, health-adjacent patterns, financial constraints, family logistics, work drafts, learning history, and negotiation strategy. Centralized systems can deliver utility, but they also create concentration risk, lock-in, and ambient disclosure.

A credible personal-agent stack needs to prove that usefulness and restraint can coexist. It should make "what did the agent know, share, block, and ask for?" as visible as the final answer.

## Research Claim

The initial claim is modest:

> A local-first, boundary-aware agent can be evaluated as a system of policy decisions, data flows, consent gates, and task outcomes, not only as generated text.

The current benchmark is synthetic and deterministic by design. That makes it inspectable and reproducible. Future work should add adversarial prompts, human annotation, real local-model adapters, secure storage, production key custody beyond deterministic lifecycle probes, production broker execution beyond broker replay, guarded child-process runner attestations, submitted-artifact runner receipts, the current macOS sandbox and Docker network-none probes, and longitudinal studies.
