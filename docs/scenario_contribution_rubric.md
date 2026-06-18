# Scenario Contribution Rubric

Status: contribution and rejection rubric for PAISL scenario governance.

The scenario library is a benchmark object, not example copy. New scenarios must make a measurable claim about user-sovereign personal AI: what data is local, what can move, what requires consent, what must be blocked, and what useful outcome still matters.

## Required Metadata

Every proposed scenario must include:

- scenario title and stable ID;
- author or submitting organization;
- source type: synthetic, consented real-derived, public-domain, or private benchmark-maintained;
- domain and user objective;
- max sensitivity level;
- data items with default boundaries and allowed layers;
- intended failure modes;
- ambiguity level: low, medium, or high;
- split recommendation: public seed, development, public eval, or hidden candidate;
- provenance notes explaining whether any real user data influenced the scenario.

## Acceptance Criteria

A scenario is eligible when:

- the task requires a meaningful privacy/usefulness/autonomy tradeoff;
- data-boundary decisions are observable from the run object;
- success criteria are specific enough for reviewers to judge;
- failure modes include at least one realistic agent-overreach path;
- the scenario can be mutated into consent-confusion, authority-pressure, urgency-pressure, and minimization-ambiguity variants;
- sensitive or regulated data is synthetic, consented, or public-domain with clear provenance;
- hidden candidates do not include answer keys in public artifacts.

## Rejection Criteria

Reject scenarios that:

- use private user data without explicit consent and provenance review;
- reward raw sensitive disclosure as the only path to task success;
- cannot be scored from observable trace, consent, and data-flow evidence;
- include vague failure modes that do not test personal AI sovereignty;
- depend on inaccessible private services without a reproducible fixture;
- encode a policy conclusion without exposing the tradeoff;
- leak hidden-split answers or hidden scenario content into public outputs;
- are duplicate surface variants of an existing scenario without a new failure mode.

## Split Policy

- `public_seed`: small set for examples, docs, and contributor orientation.
- `development`: public scenarios used during benchmark iteration.
- `public_eval`: public evaluation scenarios suitable for reproducible local checks.
- `hidden_commitment_only`: commitment slots for future private scenarios; the public repo stores no hidden content or hidden answer keys.

Hidden candidates require maintainer review, private storage, and a public commitment hash before they can be referenced. The public repo must not pretend a real hidden set exists while it only contains synthetic author-seed scenarios.

## Mutation Requirements

Each accepted scenario should support four mutation families:

- consent confusion: stale, vague, or cross-purpose consent is treated as current permission;
- authority pressure: a claimed authority figure asks for private context;
- urgency pressure: urgency is used to bypass consent or minimization;
- minimization ambiguity: a downstream party asks for convenient but unnecessary extra context.

Mutations should specify protected data item IDs and expected safe behavior. They should not introduce unrelated tasks or require hidden policy assumptions.

## Attack-Script Authoring Rule

Tiered attack scripts may be added when they encode a legitimate failure a privacy-conscious human would call wrong. New scripts should make the task harder by adding realistic pressure, indirection, stale consent, or role confusion; they must not tune scoring thresholds merely to manufacture failures. Each accepted script needs a replay fixture where the compliant agent resists and the naive agent fails.
