# Runner Hardening Profile

Status: local runner hardening contract and escape corpus for submitted artifacts.

The submitted-artifact runner now has a named hardening profile separate from the claim that an artifact passed broker/scoring checks. This distinction matters: a benchmark can accept a reproducible bundle, reject unsafe behavior, and still honestly say the runner is not production sandboxing.

## Profile Contract

Profile ID: `docker_network_none_readonly_no_new_privileges_resource_limited_v1`

The local Docker profile declares:

- `--network none`
- `--read-only`
- `--cap-drop ALL`
- `--security-opt no-new-privileges`
- `--pids-limit 64`
- `--memory 256m`
- `--tmpfs /tmp:rw,noexec,nosuid,size=16m`
- read-only artifact workspace mount at `/workspace`

The profile covers seven control categories:

| Category | Local Claim | Evidence |
| --- | --- | --- |
| Network | Direct DNS/TCP/package-registry egress should fail. | `dns-denied-under-network-none`, `package-install-denied` |
| Filesystem | Workspace and root filesystem writes should fail; tmpfs scratch is allowed. | `workspace-write-denied`, `rootfs-write-denied`, `tmpfs-write-observed` |
| Environment | Common host secret names should not be inherited. | `env-secret-absent` |
| Process | Child processes are bounded, not fully denied. | `child-process-spawn-observed` |
| Package install | Registry lookup should fail under network-none. | `package-install-denied` |
| IPC | Host Docker socket should not be mounted. | `docker-socket-absent` |
| Resource | Memory, pid, and tmpfs limits are declared. | `resource-flags-declared` |

## Escape Corpus

The escape corpus lives in `examples/runner_escape_corpus/`. Each case declares the attack shape, expected outcome, mapped probe, control, and limitation. It is intentionally small and explicit so future contributors can add cases without changing the interpretation of old results.

Current cases:

- package install attempt;
- child-process spawning;
- filesystem exfiltration;
- environment leakage;
- DNS under network-none;
- host IPC socket presence;
- resource-limit declaration.

## Seccomp and AppArmor

The current fixture runner does not ship a custom seccomp or AppArmor profile. The report records this as `documented_not_enforced_by_fixture` instead of implying stronger isolation than exists.

Why this matters:

- Docker's default seccomp profile may vary by host.
- AppArmor availability varies across Linux distributions and Docker Desktop environments.
- A production personal-agent runner would need security-reviewed syscall policy, namespace policy, mount policy, IPC policy, package policy, output policy, and adversarial stress testing.

## Commands

Run the hardening report:

```bash
pnpm runner:hardening
```

Regenerate checked-in report artifacts:

```bash
pnpm runner:hardening:write
```

The main evaluation command also regenerates `outputs/runner_hardening_report.{json,md}`.

## Non-Claims

This profile is not:

- production multi-tenant sandboxing;
- a formal proof of no exfiltration;
- a complete seccomp/AppArmor policy;
- a package allowlist;
- a side-channel defense;
- a guarantee that arbitrary model-generated code is safe to execute.

It is a local hardening scaffold with named probes and honest limitations.
