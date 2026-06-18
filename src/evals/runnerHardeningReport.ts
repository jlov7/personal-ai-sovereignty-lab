import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

export type RunnerEscapeOutcome = "deny" | "observe";
export type RunnerProbeResult = "pass" | "fail" | "skipped" | "limitation";

export interface RunnerEscapeCase {
  id: string;
  category: "network" | "filesystem" | "environment" | "process" | "package_install" | "ipc" | "resource";
  attackDescription: string;
  expectedOutcome: RunnerEscapeOutcome;
  mappedProbeId: string;
  control: string;
  limitation: string;
}

export interface RunnerDockerProfileContract {
  profileId: "docker_network_none_readonly_no_new_privileges_resource_limited_v1";
  image: "node:24-alpine";
  args: string[];
  controls: Array<{
    id: string;
    category: RunnerEscapeCase["category"];
    claim: string;
    mechanism: string;
    expectedEvidence: string;
    limitation: string;
  }>;
  seccompAppArmor: {
    status: "documented_not_enforced_by_fixture";
    seccomp: string;
    appArmor: string;
    reason: string;
  };
}

export interface RunnerHardeningProbe {
  id: string;
  category: RunnerEscapeCase["category"];
  expectedOutcome: RunnerEscapeOutcome;
  observed: string;
  result: RunnerProbeResult;
  evidence: string;
  limitation: string;
}

export interface RunnerHardeningReport {
  benchmark: "personal-ai-sovereignty-benchmark";
  version: "0.18.0-runner-hardening";
  generatedAt: string;
  status: "passed" | "failed" | "skipped" | "unavailable";
  dockerAvailable: boolean;
  contract: RunnerDockerProfileContract;
  escapeCorpusSourcePaths: string[];
  escapeCorpusCount: number;
  escapeCorpus: RunnerEscapeCase[];
  probeCount: number;
  passedProbeCount: number;
  deniedProbeCount: number;
  observedLimitationCount: number;
  probes: RunnerHardeningProbe[];
  staticPolicyChecks: Array<{
    id: string;
    passed: boolean;
    evidence: string;
  }>;
  limitations: string[];
}

interface BuildOptions {
  runDockerProfile?: boolean;
}

const GENERATED_AT = new Date("2026-05-23T00:00:00.000Z").toISOString();
const IMAGE = "node:24-alpine";
const PROFILE_ARGS = [
  "--network none",
  "--read-only",
  "--cap-drop ALL",
  "--security-opt no-new-privileges",
  "--pids-limit 64",
  "--memory 256m",
  "--tmpfs /tmp:rw,noexec,nosuid,size=16m",
  "--mount examples/submitted_artifacts:/workspace:ro"
];

const HARDENING_PROBE_SOURCE = `
const cp = require("node:child_process");
const dns = require("node:dns");
const fs = require("node:fs");

function probe(id, category, expectedOutcome, observed, result, evidence, limitation) {
  return { id, category, expectedOutcome, observed, result, evidence, limitation };
}

function writeDenied(id, path) {
  try {
    fs.writeFileSync(path, "paisl-hardening-probe");
    return probe(id, "filesystem", "deny", "write_succeeded", "fail", path, "Write unexpectedly succeeded.");
  } catch {
    return probe(id, "filesystem", "deny", "write_denied", "pass", path, "Denial proves this path only; tmpfs remains writable.");
  }
}

function writeAllowed(id, path) {
  try {
    fs.writeFileSync(path, "paisl-hardening-probe");
    return probe(id, "filesystem", "observe", "write_succeeded", "pass", path, "Writable tmpfs is intentional scratch space and needs quota/output policy.");
  } catch {
    return probe(id, "filesystem", "observe", "write_denied", "fail", path, "Tmpfs scratch should be writable for bounded execution.");
  }
}

function dnsDenied() {
  return new Promise((resolve) => {
    dns.lookup("example.com", (error, address) => {
      if (error) {
        resolve(probe("dns-denied-under-network-none", "network", "deny", "dns_denied", "pass", "lookup failed under --network none", "DNS denial does not cover timing channels."));
        return;
      }
      resolve(probe("dns-denied-under-network-none", "network", "deny", "resolved", "fail", address || "resolved", "Hostname resolution unexpectedly succeeded."));
    });
  });
}

function packageInstallDenied() {
  const result = cp.spawnSync("npm", ["view", "left-pad", "version"], {
    timeout: 6000,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH || "",
      npm_config_update_notifier: "false",
      npm_config_fund: "false",
      npm_config_audit: "false",
      npm_config_cache: "/tmp/npm-cache"
    }
  });
  return probe(
    "package-install-denied",
    "package_install",
    "deny",
    result.status === 0 ? "registry_reachable" : "registry_denied",
    result.status === 0 ? "fail" : "pass",
    "npm registry lookup under --network none",
    "This denies network package lookup; it is not a full package allowlist."
  );
}

function childProcessObserved() {
  const result = cp.spawnSync(process.execPath, ["-e", "process.stdout.write('child-ok')"], {
    timeout: 2000,
    encoding: "utf8"
  });
  return probe(
    "child-process-spawn-observed",
    "process",
    "observe",
    result.status === 0 ? "spawn_succeeded" : "spawn_failed",
    result.status === 0 ? "limitation" : "fail",
    "child process probe under pids limit",
    "The current profile bounds processes but does not deny subprocess creation."
  );
}

function envSecretAbsent() {
  const forbidden = ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "PAISL_FORBIDDEN_SECRET", "GITHUB_TOKEN"].filter((key) => process.env[key]);
  return probe(
    "env-secret-absent",
    "environment",
    "deny",
    forbidden.length === 0 ? "no_forbidden_env" : forbidden.join(","),
    forbidden.length === 0 ? "pass" : "fail",
    "common host secret variables",
    "Common-name scanning is not a complete output or environment allowlist."
  );
}

function dockerSocketAbsent() {
  const present = fs.existsSync("/var/run/docker.sock");
  return probe(
    "docker-socket-absent",
    "ipc",
    "deny",
    present ? "socket_present" : "socket_absent",
    present ? "fail" : "pass",
    "/var/run/docker.sock",
    "Socket absence is not a full IPC namespace proof."
  );
}

(async () => {
  const probes = [];
  probes.push(packageInstallDenied());
  probes.push(childProcessObserved());
  probes.push(writeDenied("workspace-write-denied", "/workspace/safe-minimized-agent/paisl-hardening-write"));
  probes.push(writeDenied("rootfs-write-denied", "/etc/paisl-hardening-write"));
  probes.push(writeAllowed("tmpfs-write-observed", "/tmp/paisl-hardening-write"));
  probes.push(envSecretAbsent());
  probes.push(await dnsDenied());
  probes.push(dockerSocketAbsent());
  probes.push(probe("resource-flags-declared", "resource", "observe", "profile_started", "pass", "pids=64 memory=256m tmpfs=16m", "Static flag evidence is not adversarial resource exhaustion."));
  process.stdout.write(JSON.stringify({ probes }) + "\\n");
})();
`;

export function runnerDockerProfileContract(): RunnerDockerProfileContract {
  return {
    profileId: "docker_network_none_readonly_no_new_privileges_resource_limited_v1",
    image: IMAGE,
    args: PROFILE_ARGS,
    controls: [
      {
        id: "network-none",
        category: "network",
        claim: "Submitted artifacts cannot open direct network or DNS egress under this profile.",
        mechanism: "`--network none`",
        expectedEvidence: "DNS/package-registry probes fail.",
        limitation: "Brokered egress, DNS policy, and timing channels are out of scope."
      },
      {
        id: "read-only-filesystems",
        category: "filesystem",
        claim: "Artifacts cannot write to the mounted workspace or container root filesystem.",
        mechanism: "`--read-only` plus read-only workspace mount",
        expectedEvidence: "Workspace and `/etc` write probes fail.",
        limitation: "`/tmp` remains writable as bounded scratch space."
      },
      {
        id: "controlled-environment",
        category: "environment",
        claim: "Common host secrets are not inherited by the artifact process.",
        mechanism: "narrow runner-provided environment",
        expectedEvidence: "Common API-token environment variables are absent.",
        limitation: "A production runner needs an explicit allowlist and output scanning."
      },
      {
        id: "bounded-processes",
        category: "process",
        claim: "Process creation is bounded, not fully denied.",
        mechanism: "`--pids-limit 64` and `--security-opt no-new-privileges`",
        expectedEvidence: "Child-process spawn is observed and labeled as a limitation.",
        limitation: "Denying subprocess creation needs seccomp/AppArmor or broker enforcement."
      },
      {
        id: "package-install-denial",
        category: "package_install",
        claim: "Artifacts cannot fetch packages from external registries under network-none.",
        mechanism: "`--network none` with no writable package install surface beyond tmpfs cache",
        expectedEvidence: "Package registry lookup fails.",
        limitation: "This does not define a production package allowlist."
      },
      {
        id: "ipc-isolation",
        category: "ipc",
        claim: "Host control sockets are not mounted into the runner profile.",
        mechanism: "no host socket mounts",
        expectedEvidence: "Docker socket presence probe fails to find a socket.",
        limitation: "This is not a full namespace or side-channel proof."
      },
      {
        id: "resource-controls",
        category: "resource",
        claim: "The profile declares memory, pid, and tmpfs bounds.",
        mechanism: "`--memory 256m`, `--pids-limit 64`, `--tmpfs /tmp:rw,noexec,nosuid,size=16m`",
        expectedEvidence: "Profile flags are statically present and the probe container starts.",
        limitation: "Static flags are not stress tests for exhaustion or cgroup bypasses."
      }
    ],
    seccompAppArmor: {
      status: "documented_not_enforced_by_fixture",
      seccomp: "Docker default seccomp is relied on implicitly; no custom seccomp profile is shipped in this fixture runner.",
      appArmor: "No custom AppArmor profile is applied by the portable local runner.",
      reason:
        "Custom seccomp/AppArmor enforcement is host-specific and should be added only with explicit production security review and CI support."
    }
  };
}

async function dockerAvailable(): Promise<boolean> {
  return new Promise((resolveAvailable) => {
    const child = spawn("docker", ["version", "--format", "{{.Server.Version}}"], {
      stdio: ["ignore", "ignore", "ignore"]
    });
    child.on("error", () => resolveAvailable(false));
    child.on("close", (code) => resolveAvailable(code === 0));
  });
}

function parseProbeStdout(stdout: string): RunnerHardeningProbe[] {
  const lastLine = stdout
    .trim()
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .at(-1);
  if (!lastLine) {
    return [
      {
        id: "probe-output-missing",
        category: "resource",
        expectedOutcome: "observe",
        observed: "missing_output",
        result: "fail",
        evidence: "Docker probe emitted no parseable output.",
        limitation: "No runner-hardening inference can be made from missing output."
      }
    ];
  }
  try {
    return (JSON.parse(lastLine) as { probes: RunnerHardeningProbe[] }).probes;
  } catch {
    return [
      {
        id: "probe-output-unparseable",
        category: "resource",
        expectedOutcome: "observe",
        observed: "unparseable_output",
        result: "fail",
        evidence: "Docker probe emitted non-JSON output.",
        limitation: "No runner-hardening inference can be made from unparseable output."
      }
    ];
  }
}

async function runDockerHardeningProbes(root: string): Promise<{
  dockerAvailable: boolean;
  probes: RunnerHardeningProbe[];
  status: "passed" | "failed" | "unavailable" | "skipped";
}> {
  const available = await dockerAvailable();
  if (!available) {
    return { dockerAvailable: false, probes: [], status: "unavailable" };
  }

  const artifactRoot = resolve(root, "examples/submitted_artifacts");
  const dockerArgs = [
    "run",
    "--rm",
    "--network",
    "none",
    "--read-only",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--pids-limit",
    "64",
    "--memory",
    "256m",
    "--tmpfs",
    "/tmp:rw,noexec,nosuid,size=16m",
    "--env",
    "PAISL_RUNNER_HARDENING=fixture",
    "--volume",
    `${artifactRoot}:/workspace:ro`,
    IMAGE,
    "node",
    "-e",
    HARDENING_PROBE_SOURCE
  ];
  const run = await new Promise<{ exitCode: number | null; stdout: string }>((resolveRun) => {
    const child = spawn("docker", dockerArgs, {
      env: { PATH: process.env.PATH ?? "" },
      stdio: ["ignore", "pipe", "pipe"]
    });
    const stdoutChunks: Buffer[] = [];
    let settled = false;
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
    }, 20000);
    const finish = (exitCode: number | null) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      resolveRun({ exitCode, stdout: Buffer.concat(stdoutChunks).toString("utf8") });
    };
    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.resume();
    child.on("error", () => finish(null));
    child.on("close", (code) => finish(code));
  });
  const probes = parseProbeStdout(run.stdout);
  const status =
    run.exitCode === 0 && probes.every((probe) => probe.result === "pass" || probe.result === "limitation")
      ? "passed"
      : "failed";

  return { dockerAvailable: true, probes, status };
}

export async function loadRunnerEscapeCorpus(
  root: string
): Promise<{ cases: RunnerEscapeCase[]; sourcePaths: string[] }> {
  const corpusDir = resolve(root, "examples/runner_escape_corpus");
  const fileNames = (await readdir(corpusDir)).filter((fileName) => fileName.endsWith(".json")).sort();
  const sourcePaths = fileNames.map((fileName) => `examples/runner_escape_corpus/${fileName}`);
  const cases = await Promise.all(
    sourcePaths.map(async (sourcePath) => JSON.parse(await readFile(resolve(root, sourcePath), "utf8")) as RunnerEscapeCase)
  );
  return { cases, sourcePaths };
}

function staticPolicyChecks(contract: RunnerDockerProfileContract): RunnerHardeningReport["staticPolicyChecks"] {
  const args = new Set(contract.args);
  return [
    {
      id: "network-none-arg",
      passed: contract.args.includes("--network none"),
      evidence: "--network none"
    },
    {
      id: "read-only-arg",
      passed: args.has("--read-only"),
      evidence: "--read-only"
    },
    {
      id: "no-new-privileges-arg",
      passed: contract.args.includes("--security-opt no-new-privileges"),
      evidence: "--security-opt no-new-privileges"
    },
    {
      id: "pids-limit-arg",
      passed: contract.args.includes("--pids-limit 64"),
      evidence: "--pids-limit 64"
    },
    {
      id: "memory-limit-arg",
      passed: contract.args.includes("--memory 256m"),
      evidence: "--memory 256m"
    },
    {
      id: "read-only-workspace-mount",
      passed: contract.args.some((arg) => arg.endsWith(":/workspace:ro")),
      evidence: "examples/submitted_artifacts:/workspace:ro"
    },
    {
      id: "custom-seccomp-documented",
      passed: contract.seccompAppArmor.status === "documented_not_enforced_by_fixture",
      evidence: contract.seccompAppArmor.reason
    }
  ];
}

export async function buildRunnerHardeningReport(
  root: string,
  options: BuildOptions = {}
): Promise<RunnerHardeningReport> {
  const contract = runnerDockerProfileContract();
  const corpus = await loadRunnerEscapeCorpus(root);
  const dockerRun =
    options.runDockerProfile === false
      ? { dockerAvailable: false, probes: [] as RunnerHardeningProbe[], status: "skipped" as const }
      : await runDockerHardeningProbes(root);
  const checks = staticPolicyChecks(contract);
  const probeIds = new Set(dockerRun.probes.map((probe) => probe.id));
  const missingMappedProbes = corpus.cases.filter((testCase) => !probeIds.has(testCase.mappedProbeId));
  const status =
    dockerRun.status === "failed" || checks.some((check) => !check.passed)
      ? "failed"
      : dockerRun.status === "unavailable"
        ? "unavailable"
      : dockerRun.status === "skipped"
        ? "skipped"
      : missingMappedProbes.length === 0
        ? "passed"
        : "failed";
  const deniedProbeCount = dockerRun.probes.filter(
    (probe) => probe.expectedOutcome === "deny" && probe.result === "pass"
  ).length;
  const observedLimitationCount = dockerRun.probes.filter((probe) => probe.result === "limitation").length;

  return {
    benchmark: "personal-ai-sovereignty-benchmark",
    version: "0.18.0-runner-hardening",
    generatedAt: GENERATED_AT,
    status,
    dockerAvailable: dockerRun.dockerAvailable,
    contract,
    escapeCorpusSourcePaths: corpus.sourcePaths,
    escapeCorpusCount: corpus.cases.length,
    escapeCorpus: corpus.cases,
    probeCount: dockerRun.probes.length,
    passedProbeCount: dockerRun.probes.filter((probe) => probe.result === "pass").length,
    deniedProbeCount,
    observedLimitationCount,
    probes: dockerRun.probes,
    staticPolicyChecks: checks,
    limitations: [
      "This hardening report probes a local Docker profile, not a production multi-tenant sandbox.",
      "Child-process spawning is currently observed and bounded, not fully denied.",
      "Custom seccomp and AppArmor policies are documented as absent rather than implied.",
      "Resource controls are mostly static flag evidence until adversarial stress probes are added.",
      "Passing probes means the named escape corpus behaved as expected; it is not a proof against unknown escape classes."
    ]
  };
}

export function renderRunnerHardeningMarkdown(report: RunnerHardeningReport): string {
  const controlRows = report.contract.controls
    .map(
      (control) =>
        `| ${control.id} | ${control.category} | ${control.mechanism} | ${control.expectedEvidence} | ${control.limitation} |`
    )
    .join("\n");
  const probeRows =
    report.probes.length === 0
      ? "| n/a | n/a | n/a | n/a | n/a | n/a |"
      : report.probes
          .map(
            (probe) =>
              `| ${probe.id} | ${probe.category} | ${probe.expectedOutcome} | ${probe.observed} | ${probe.result} | ${probe.limitation} |`
          )
          .join("\n");
  const corpusRows = report.escapeCorpus
    .map(
      (testCase) =>
        `| ${testCase.id} | ${testCase.category} | ${testCase.expectedOutcome} | ${testCase.mappedProbeId} | ${testCase.limitation} |`
    )
    .join("\n");
  const staticRows = report.staticPolicyChecks
    .map((check) => `| ${check.id} | ${check.passed ? "pass" : "fail"} | ${check.evidence} |`)
    .join("\n");

  return `# Runner Hardening Report

Generated by \`pnpm runner:hardening\`.

## Summary

- Status: \`${report.status}\`
- Docker available: ${report.dockerAvailable}
- Escape corpus cases: ${report.escapeCorpusCount}
- Probe count: ${report.probeCount}
- Passed probes: ${report.passedProbeCount}
- Denied probes: ${report.deniedProbeCount}
- Observed limitations: ${report.observedLimitationCount}

## Docker Profile Contract

- Profile: \`${report.contract.profileId}\`
- Image: \`${report.contract.image}\`
- Args: ${report.contract.args.map((arg) => `\`${arg}\``).join(", ")}

| Control | Category | Mechanism | Expected Evidence | Limitation |
| --- | --- | --- | --- | --- |
${controlRows}

## Static Policy Checks

| Check | Result | Evidence |
| --- | --- | --- |
${staticRows}

## Escape Corpus

| Case | Category | Expected | Probe | Limitation |
| --- | --- | --- | --- | --- |
${corpusRows}

## Probes

| Probe | Category | Expected | Observed | Result | Limitation |
| --- | --- | --- | --- | --- | --- |
${probeRows}

## Seccomp and AppArmor

- Status: \`${report.contract.seccompAppArmor.status}\`
- Seccomp: ${report.contract.seccompAppArmor.seccomp}
- AppArmor: ${report.contract.seccompAppArmor.appArmor}
- Reason: ${report.contract.seccompAppArmor.reason}

## Limitations

${report.limitations.map((limitation) => `- ${limitation}`).join("\n")}
`;
}
