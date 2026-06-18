# Technical Memo: Personal AI Sovereignty Lab (PAISL)

## Abstract

Personal AI agents will become useful precisely because they can reason over intimate context: notes, schedules, finances, health-like records, learning histories, family logistics, and negotiation preferences. Existing LLM benchmarks rarely evaluate whether such agents preserve user control while remaining useful. This memo describes a benchmark scaffold for user-sovereign personal AI agents. The benchmark models three compute layers, records data-boundary decisions, simulates consent gates, scores privacy/usefulness/autonomy tradeoffs, and preserves failure cases. The current implementation is deterministic and synthetic by design, making it reproducible while leaving room for future live-model evaluation.

## 1. Summary

Personal AI Sovereignty Lab is a local-first agent simulation and evaluation harness. It demonstrates how personal agents can be evaluated through boundary decisions, consent gates, data minimization, and usefulness rather than final text alone.

The current release also includes executable egress probes, tamper-evident consent receipts, keyed signed-consent probes, deterministic key-custody lifecycle probes, brokered trace attestations, sandboxed trace-runner attestations, submitted-artifact receipts, storage-backed runtime fetch mediation, a child-process preload egress guard, macOS sandbox and Docker container network-denial probes, submitted-artifact Docker profile probes, revocation and expiry checks, retention-deadline simulation, executable tool-call traces, aggregate reconstruction-risk stress tests, synthetic aggregate attack pressure, synthetic cohort uniqueness attacks, semi-realistic aggregate privacy challenges, annotation agreement aggregation, baseline submission intake, scorecard stress tests, baseline separability checks, scenario coverage reporting, artifact hash verification, and bounded local-model adversarial calibration.

## 2. System Design

The system is intentionally small:

- scenario fixtures define tasks and data sensitivity
- governance rules classify data-boundary decisions
- a deterministic local model abstraction generates actions and explanations
- privacy helpers estimate minimization and budget usage
- an egress guard simulates consent receipts, revocation, expiry, retention deadlines, and release-form checks
- signed consent probes test keyed receipt integrity against tampering, revocation, and scope mismatch
- key-custody lifecycle probes test rotation, retirement, revocation, historical verification, and hash-chain tampering semantics
- a storage-backed runtime adapter persists consent events and blocks unsafe fetch calls before execution
- a process-level preload guard traps common Node network primitives in a child process before untrusted benchmark code can execute outbound calls
- an OS confinement probe uses macOS sandboxing to deny loopback network access for a child process
- a container confinement probe uses Docker `--network none` to deny host egress for the same code path that passes with normal container networking
- a deterministic broker replays submitted external traces, records execution/block decisions, and signs the canonical attestation payload
- a sandboxed trace runner executes broker-approved actions in a guarded child process and preserves direct escape-attempt denials
- a submitted-artifact runner executes fixture agent artifacts, binds source digests to emitted traces and signed receipts, and probes a Docker hardened profile
- deterministic tool adapters emit inspectable tool-call traces, including unsafe raw-egress negative controls
- aggregate-risk probes stress-test synthetic linkability before collective release
- aggregate-attack probes apply rare-cohort linkage, auxiliary-context join, and differencing-pressure heuristics
- synthetic cohort probes estimate quasi-identifier uniqueness pressure for aggregate candidates
- aggregate privacy challenges compare naive and controlled target inference over deterministic semi-realistic microdata
- annotation and baseline-submission reports preserve the difference between seed fixtures and external evidence
- scorecard stress checks look for negative-control collapse and ceiling effects
- an evaluation scorer produces a multi-metric scorecard
- a transcript evaluator judges model-generated plans against the deterministic policy oracle
- the React UI makes the trace inspectable

No external model provider is required. This keeps the demo reproducible and avoids making privacy claims while sending data to a cloud API. OpenAI-compatible local model evaluation is available through `pnpm model:eval`, and the checked-in sample transcript includes a local `gemma4:26b` sweep across all scenarios.

## 3. Benchmark Object

The benchmark object is not a model answer. It is the full evaluated run:

```text
scenario + consent state + agent actions + governance decisions + data-flow trace + scorecard + failure cases + optional model transcript findings
```

This matters because a personal agent can produce a useful answer while still violating the user's boundary. A benchmark that sees only the answer misses the central risk.

## 4. Tradeoffs

| Choice | Benefit | Cost |
| --- | --- | --- |
| Deterministic mocked model | Reproducible and inspectable | Only optional transcript runs test real LLM failure modes |
| TypeScript policy rules | Easy to read and test | Not a formal policy language |
| Synthetic scenarios | Safe to publish | Requires future validation |
| Heuristic scoring | Transparent and fast | Not a scientific benchmark |
| Local Vite app | Easy to run | Not a deployed product |
| Consented escalation metric | Separates useful sovereignty from blanket refusal | Requires careful scenario labeling |
| Tamper-evident consent receipts | Makes consent scope, expiry, and revocation auditable in tests | Not legal signing or production key management |
| Keyed signed-consent probes | Separates receipt integrity from policy scope and revocation | Deterministic fixture key, not production key custody or non-repudiation |
| Key-custody lifecycle probes | Tests rotation, retirement, revocation, historical verification, and hash-chain tamper detection | Deterministic fixture keys, not secure user-held custody or recovery |
| Storage-backed runtime mediation | Proves blocked raw payloads, untrusted hosts, and revoked consent do not execute fetch calls in the instrumented path | Not OS/network sandboxing |
| Process preload egress guard | Traps Fetch, HTTP, HTTPS, raw TCP, and TLS attempts in a guarded child process | Bypassable outside the guarded Node preload path; not a kernel firewall |
| macOS sandbox probe | Proves OS-level network denial for a child process with an unsandboxed positive control | Single-platform experiment, not a complete production confinement layer |
| Docker network-none probe | Proves container network denial for the probed host-egress path with a positive control | Does not cover filesystem, IPC, DNS policy beyond the probe, package installation, or a production broker |
| Brokered trace attestations | Turns submitted action traces into signed replay evidence and catches unsafe completed-action claims | Deterministic fixture key and replay semantics; not a production broker, identity-bound signature, or sandboxed third-party execution |
| Sandboxed trace runner | Executes broker-approved fixture actions inside a guarded child process and denies direct escape attempts | Preload-based runner profile; not kernel isolation, package isolation, or arbitrary third-party-code execution |
| Submitted artifact runner | Executes fixture artifacts, binds source SHA-256 digests to emitted traces, preserves broker/sandbox attestations, and probes Docker hardening controls | Author fixtures and fixture keys; not independent baseline evidence or production multi-tenant sandboxing |
| In-process tool traces | Makes tool-use behavior inspectable and testable | Not a production business API or network broker |
| Synthetic aggregate-risk, attack, and cohort probes | Prevents uncritical aggregate release | Not empirical reconstruction testing or formal DP |
| Aggregate privacy challenge | Measures target inference before and after controls on semi-realistic synthetic microdata | Synthetic fixture, not an independent real-data attack |
| Annotation agreement and baseline submission reports | Turns external validation into a machine-readable intake process | Checked-in seed data is not independent validation |
| Scorecard stress report | Catches obvious scoring collapse before external review | Still author-defined and not calibrated to human judgment |

## 5. Limitations

- No secure local storage layer
- Local-model evaluation is transcript-level; it does not execute real tools or external actions
- No legally signed or externally authenticated consent receipts; current signed-consent and key-custody probes use deterministic fixture keys
- No formal privacy guarantees
- No human evaluation dataset
- No real external business API integration
- No complete production OS/network confinement; the macOS sandbox and Docker network-none probes cover specific child/container paths
- No production broker execution; current broker attestations replay checked-in traces with a deterministic fixture key
- No arbitrary third-party production sandbox runner; current sandboxed trace runner and submitted-artifact runner execute checked-in fixtures under local guard/Docker profiles
- No empirical aggregate linkage attack against consented real data or differential privacy accounting
- Scorecard stress checks do not replace independent label calibration
- Annotation and baseline intake reports have no independent data yet

## 6. Research Direction

The next version should convert the public-validation scaffold into a validation program: collect independent human annotations, run stronger live model and tool-agent baselines through the submitted-artifact contract, add secure local data fixtures, integrate a production broker around the confinement probes, evaluate aggregate reconstruction risk, and replace simulated consent receipts with signed production receipts. The important research object is the agent system as a set of inspectable decisions, not the UI alone.

## 7. Conclusion

The project is a seed standard: a compact, runnable way to ask whether personal AI agents are useful without becoming extractive. It does not solve personal AI privacy. It makes the right failures visible enough to evaluate.
