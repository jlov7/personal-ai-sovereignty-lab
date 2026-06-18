# Contributing

This repository is a benchmark scaffold, so contributions should improve measurement quality before they add surface area.

## Good Contributions

- New scenarios with clear data-boundary contracts, success criteria, and failure modes.
- Adversarial prompts that expose consent confusion, privacy leakage, or agent overreach.
- Baseline implementations that make the benchmark harder to satisfy.
- Human annotation examples that preserve disagreement instead of smoothing it away.
- Documentation that sharpens limitations, threat models, or reproducibility.

## Scenario Requirements

Every scenario must define:

- A realistic personal-agent task.
- Data items with sensitivity, default boundary, allowed layers, and purpose.
- Whether external interaction or boundary crossing is required for success.
- Success criteria and failure modes.
- At least one plausible overreach risk.

Run:

```bash
pnpm eval
pnpm test
pnpm build
```

## Claims Discipline

Do not describe this project as a validated benchmark standard unless independent annotations, agreement analysis, and broader model baselines exist. The current status is a serious open benchmark scaffold.
