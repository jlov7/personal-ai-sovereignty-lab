# Artifact Bundle Standard

Status: seed submission standard for PAISL baseline artifacts.

The artifact bundle standard defines the minimum evidence a submitted personal-agent baseline must provide before it can be run, scored, or cited. It is intentionally stricter than a trace upload: a bundle must bind the code entrypoint, runtime assumptions, scenario coverage, expected outputs, and claim boundaries into a reviewable object.

## Bundle Object

A valid bundle lives under `examples/artifact_bundles/<artifact-id>/` and includes:

- `bundle.json`: schema-backed manifest.
- `agent.mjs`: deterministic fixture entrypoint for the seed examples.
- any supporting files listed in `sourceDigests`.

The manifest contract is defined in `schemas/artifact-bundle.schema.json`.

## Required Manifest Evidence

Each bundle must declare:

- manifest version and artifact identity;
- submitter identity and independence class;
- system name, version, and system type;
- bundle version, using exact SemVer with prerelease labels allowed for release-candidate bundles;
- pinned runtime metadata with exact engine version, resource limits, network posture, filesystem posture, timeout, and runtime digest;
- entrypoint command and path;
- source file SHA-256 digests and byte sizes;
- scenario coverage, expected trace ids, expected boundary decisions, and consent profile;
- expected output locations;
- allowed write paths;
- claim boundaries and limitations.

## Verification Gates

`pnpm artifact:bundles` runs the bundle verifier and transparency-ledger probe.

The verifier rejects:

- missing or unparseable manifests;
- missing required manifest fields;
- missing or weak claim boundaries;
- unpinned runtime metadata such as `latest`;
- mismatched runtime digests;
- missing entrypoints;
- missing or mismatched source digests;
- missing scenario coverage;
- missing expected outputs;
- undeclared writes during opt-in execution in a temporary copy.

By default, `pnpm artifact:bundles` does not execute entrypoints; it verifies static packaging integrity, source digests, path containment, scenario coverage, expected outputs, and claim boundaries. Runtime side-effect checks require `PAISL_EXECUTE_BUNDLES=1` on an isolated host. Passing this gate means the bundle is reproducible and reviewable. It does not mean the agent behavior is safe. Unsafe behavior still has to be caught by broker, sandbox, scorer, and review gates.

## Seed Fixtures

The repo includes three fixtures:

| Bundle | Expected | Purpose |
| --- | --- | --- |
| `safe-minimized-agent` | pass | Valid minimized-payload fixture. |
| `raw-upload-agent` | pass | Valid packaging around unsafe behavior; later gates must reject the behavior. |
| `malformed-unexpected-write-agent` | fail | Negative control for missing claim boundaries, unpinned runtime metadata, and undeclared writes. |

The malformed fixture is kept in the repo deliberately. It makes verifier rejection testable rather than implied.

## Transparency Ledger

`outputs/artifact_transparency_ledger_report.md` chains submitted-artifact runner receipts into a deterministic hash ledger:

- each entry records the previous entry hash;
- each entry binds the submitted-artifact receipt hash;
- each entry binds the matching bundle manifest hash when available;
- a tamper probe mutates a receipt hash and verifies that chain integrity fails.

This is not a production append-only transparency service. It is a deterministic scaffold showing the evidence object a public benchmark intake path would need.

## Public Intake Boundary

External submissions should not be accepted as benchmark evidence until they provide:

- a valid artifact bundle;
- a runner receipt;
- broker and sandbox attestations;
- scorecard output;
- explicit claim boundaries;
- enough trace evidence for reviewers to audit data movement.

Independent submissions are still external blockers. Seed fixtures exercise the contract but do not count as independent baselines.
