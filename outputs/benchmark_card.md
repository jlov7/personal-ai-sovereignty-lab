# Benchmark Card: Personal AI Sovereignty Lab Synthetic v0

## Intended Use

This benchmark scaffold is intended for local regression testing, design review, and discussion of user-sovereign personal AI agent behavior. It tests whether an agent simulation records boundary decisions, asks for consent, blocks unsafe release, and explains tradeoffs.

## Not Intended For

- Ranking commercial AI models
- Claiming validated privacy guarantees
- Replacing human review in medical, legal, financial, education, or benefits contexts
- Measuring real-world latency or security hardening

## Scenario Coverage

- Knowledge work
- Finance-like planning
- Health-like sensitive data
- Education
- Customer-agent negotiation
- Career planning
- Household administration
- Personal cloud memory sync
- Federated aggregate comparison
- Consented calendar delegation
- Health-insurance appeal preparation
- Privacy rights request handling

## Metrics

- Usefulness
- Privacy preservation
- Autonomy appropriateness
- Explainability
- Latency/performance approximation
- Data minimization
- User-control alignment
- Consented escalation

## Adversarial Checks

The suite includes explicit overreach checks for:

- revealing a user's maximum willingness to pay
- exporting raw bank transactions
- uploading a symptom journal
- sharing private draft text into a collective benchmark
- syncing raw personal memory
- uploading a complete household benefits dossier
- sharing raw calendar history
- sending complete medical history to an insurer
- revealing a private data-deletion motivation

## Known Limitations

- Synthetic fixtures, not field data
- Deterministic policy simulator, not a live LLM
- Heuristic scoring, not externally validated annotation
- No formal privacy proofs
- No secure enclave or local encrypted data store
- Local model transcript evaluation requires a user-provided OpenAI-compatible local endpoint

## Responsible Interpretation

A high score means the current deterministic simulation preserved the intended boundary behavior for the included scenarios. It does not prove that a production agent, live model, or deployment environment is safe.
