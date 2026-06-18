import { spawn } from "node:child_process";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { brokerExternalTrace, verifyBrokerAttestation } from "../broker/traceBroker";
import {
  runSandboxedTrace,
  verifySandboxedExecutionAttestation
} from "../broker/sandboxedTraceRunner";
import type { ExternalAgentTrace } from "./externalTraceEvaluator";
import type { BaselineSystemType } from "./baselineSubmission";

export interface SubmittedArtifactManifest {
  artifactId: string;
  scenarioId: string;
  systemName: string;
  systemVersion: string;
  systemType: BaselineSystemType;
  entrypoint: string;
  expectedTraceId: string;
  claimBoundaries: string[];
}

export interface LoadedSubmittedArtifact {
  manifest: SubmittedArtifactManifest;
  manifestPath: string;
  entrypointPath: string;
  sourcePath: string;
  sourceSha256: string;
  sourceBytes: number;
}

export interface SubmissionReceipt {
  receiptId: string;
  artifactId: string;
  runnerVersion: "0.17.0-submitted-artifact-runner";
  generatedAt: string;
  scenarioId: string;
  expectedTraceId: string;
  emittedTraceId: string | null;
  sourcePath: string;
  sourceSha256: string;
  sourceBytes: number;
  traceSha256: string | null;
  brokerAttestationId: string | null;
  sandboxedExecutionAttestationId: string | null;
  passed: boolean;
  signature: {
    algorithm: "HMAC-SHA256";
    keyId: "paisl-submission-receipt-fixture-v1";
    canonicalization: "json-stable-sort-v1";
    value: string;
  };
}

export interface SubmittedArtifactExecution {
  artifactId: string;
  sourcePath: string;
  sourceSha256: string;
  artifactExitCode: number | null;
  emittedTraceId: string | null;
  traceMatchesManifest: boolean;
  brokerSignatureValid: boolean;
  brokerExecutedActionCount: number;
  brokerBlockedActionCount: number;
  sandboxedExecutionPassed: boolean;
  sandboxedChildExecutedActionCount: number;
  sandboxedSkippedByBrokerCount: number;
  receiptVerified: boolean;
  passed: boolean;
  limitations: string[];
}

export interface DockerProfileProbe {
  id: string;
  expected: string;
  observed: string;
  errorCode: string | null;
  passed: boolean;
}

export interface SubmittedArtifactDockerProfile {
  status: "passed" | "failed" | "unavailable" | "skipped";
  dockerAvailable: boolean;
  image: "node:24-alpine";
  profile: "docker_network_none_readonly_workspace_no_new_privileges";
  profileArgs: string[];
  controlProbeCount: number;
  passedControlProbeCount: number;
  probes: DockerProfileProbe[];
  limitations: string[];
}

export interface SubmittedArtifactRunnerReport {
  benchmark: string;
  version: string;
  generatedAt: string;
  runnerMode: "submitted_artifact_contract_with_broker_and_sandbox_attestations";
  sourcePaths: string[];
  submissionCount: number;
  traceEmissionCount: number;
  signedReceiptCount: number;
  verifiedReceiptCount: number;
  passedSubmissionCount: number;
  brokerExecutedActionCount: number;
  brokerBlockedActionCount: number;
  sandboxedExecutionPassedCount: number;
  dockerProfile: SubmittedArtifactDockerProfile;
  receipts: SubmissionReceipt[];
  executions: SubmittedArtifactExecution[];
  limitations: string[];
}

interface BuildOptions {
  runDockerProfile?: boolean;
}

const GENERATED_AT = new Date("2026-05-23T00:00:00.000Z").toISOString();
const RUNNER_VERSION = "0.17.0-submitted-artifact-runner";
const RECEIPT_SIGNING_KEY = "paisl-public-fixture-submission-receipt-key-not-secret-v1";
const IMAGE = "node:24-alpine";
const DOCKER_PROFILE_ARGS = [
  "--network none",
  "--read-only",
  "--cap-drop ALL",
  "--security-opt no-new-privileges",
  "--pids-limit 64",
  "--memory 256m",
  "--tmpfs /tmp:rw,noexec,nosuid,size=16m",
  "--mount examples/submitted_artifacts:/workspace:ro"
];

const DOCKER_PROBE_SOURCE = `
const fs = require("node:fs");
const net = require("node:net");
const host = process.argv[1];
const port = Number(process.argv[2]);

function record(id, expected, observed, errorCode, passed) {
  return { id, expected, observed, errorCode, passed };
}

function writeDenied(id, path) {
  try {
    fs.writeFileSync(path, "paisl-write-probe");
    return record(id, "write_denied", "write_succeeded", null, false);
  } catch (error) {
    return record(id, "write_denied", "write_denied", "DENIED", true);
  }
}

function writeAllowed(id, path) {
  try {
    fs.writeFileSync(path, "paisl-tmp-probe");
    return record(id, "write_allowed", "write_succeeded", null, true);
  } catch (error) {
    return record(id, "write_allowed", "write_denied", error && error.code ? error.code : "ERROR", false);
  }
}

function networkDenied() {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let settled = false;
    const finish = (observed, errorCode, passed) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(record("network-none-denies-host-egress", "connection_denied", observed, errorCode, passed));
    };
    socket.setTimeout(2500);
    socket.on("connect", () => finish("connected", null, false));
    socket.on("error", () => finish("connection_denied", "DENIED", true));
    socket.on("timeout", () => finish("connection_denied", "DENIED", true));
  });
}

(async () => {
  const probes = [];
  probes.push(await networkDenied());
  probes.push(writeDenied("readonly-workspace-denies-write", "/workspace/safe-minimized-agent/paisl-write-probe"));
  probes.push(writeDenied("readonly-rootfs-denies-etc-write", "/etc/paisl-write-probe"));
  probes.push(writeAllowed("tmpfs-allows-ephemeral-write", "/tmp/paisl-tmp-probe"));
  const leaked = ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "PAISL_FORBIDDEN_SECRET"].filter((key) => process.env[key]);
  probes.push(record("controlled-env-has-no-sensitive-host-secrets", "no_forbidden_env", leaked.length === 0 ? "no_forbidden_env" : leaked.join(","), null, leaked.length === 0));
  probes.push(record("profile-flags-accepted", "docker_profile_started", "docker_profile_started", null, true));
  process.stdout.write(JSON.stringify({ probes }) + "\\n");
})();
`;

function sortForSignature(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortForSignature);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, sortForSignature(entry)])
    );
  }
  return value;
}

function canonical(value: unknown): string {
  return JSON.stringify(sortForSignature(value));
}

function hmac(value: unknown): string {
  return createHmac("sha256", RECEIPT_SIGNING_KEY).update(canonical(value)).digest("hex");
}

function sha256(contents: string | Buffer): string {
  return createHash("sha256").update(contents).digest("hex");
}

function unsignedReceipt(receipt: SubmissionReceipt): Omit<SubmissionReceipt, "signature"> {
  const { signature: _signature, ...unsigned } = receipt;
  return unsigned;
}

function signReceipt(unsigned: Omit<SubmissionReceipt, "signature">): SubmissionReceipt {
  return {
    ...unsigned,
    signature: {
      algorithm: "HMAC-SHA256",
      keyId: "paisl-submission-receipt-fixture-v1",
      canonicalization: "json-stable-sort-v1",
      value: hmac(unsigned)
    }
  };
}

export function verifySubmissionReceipt(receipt: SubmissionReceipt): { valid: boolean; reason: string } {
  const expected = hmac(unsignedReceipt(receipt));
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(receipt.signature.value, "hex");
  const valid =
    actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);

  return valid
    ? { valid: true, reason: "Submission receipt signature matches the canonical payload." }
    : { valid: false, reason: "Submission receipt signature does not match the canonical payload." };
}

async function listArtifactManifestPaths(root: string): Promise<string[]> {
  const base = resolve(root, "examples/submitted_artifacts");
  if (!existsSync(base)) {
    return [];
  }
  const entries = await readdir(base, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => `examples/submitted_artifacts/${entry.name}/manifest.json`)
    .sort();
}

export async function loadSubmittedArtifacts(
  root: string
): Promise<{ artifacts: LoadedSubmittedArtifact[]; sourcePaths: string[] }> {
  const manifestPaths = await listArtifactManifestPaths(root);
  const artifacts = await Promise.all(
    manifestPaths.map(async (manifestPath) => {
      const manifest = JSON.parse(await readFile(resolve(root, manifestPath), "utf8")) as SubmittedArtifactManifest;
      const entrypointPath = resolve(root, dirname(manifestPath), manifest.entrypoint);
      const source = await readFile(entrypointPath);
      return {
        manifest,
        manifestPath,
        entrypointPath,
        sourcePath: `${dirname(manifestPath)}/${manifest.entrypoint}`,
        sourceSha256: sha256(source),
        sourceBytes: source.byteLength
      };
    })
  );

  return {
    artifacts,
    sourcePaths: artifacts.flatMap((artifact) => [artifact.manifestPath, artifact.sourcePath])
  };
}

function parseLastJsonLine<T>(stdout: string): T {
  const lastLine = stdout
    .trim()
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .at(-1);
  if (!lastLine) {
    throw new Error("Submitted artifact emitted no JSON trace");
  }
  return JSON.parse(lastLine) as T;
}

async function executeArtifact(artifact: LoadedSubmittedArtifact): Promise<{
  exitCode: number | null;
  stdout: string;
  stderr: string;
  trace: ExternalAgentTrace | null;
}> {
  return new Promise((resolveExecution) => {
    const child = spawn(process.execPath, [artifact.entrypointPath], {
      cwd: dirname(artifact.entrypointPath),
      env: {
        PATH: process.env.PATH ?? "",
        PAISL_SUBMITTED_ARTIFACT_ID: artifact.manifest.artifactId
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let settled = false;
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
    }, 10000);
    const finish = (exitCode: number | null) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      const stdout = Buffer.concat(stdoutChunks).toString("utf8");
      const stderr = Buffer.concat(stderrChunks).toString("utf8");
      let trace: ExternalAgentTrace | null = null;
      if (exitCode === 0) {
        try {
          trace = parseLastJsonLine<ExternalAgentTrace>(stdout);
        } catch {
          trace = null;
        }
      }
      resolveExecution({ exitCode, stdout, stderr, trace });
    };
    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
    child.on("error", () => finish(null));
    child.on("close", (code) => finish(code));
  });
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

async function listenOnHost(): Promise<{ server: net.Server; port: number }> {
  const server = net.createServer((socket) => {
    socket.on("error", () => undefined);
    socket.end("ok");
  });
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "0.0.0.0", () => resolveListen());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not allocate host TCP port for submitted artifact Docker probe");
  }
  return { server, port: address.port };
}

function closeServer(server: net.Server): Promise<void> {
  return new Promise((resolveClose, reject) => {
    server.close((error) => (error ? reject(error) : resolveClose()));
  });
}

function skippedDockerProfile(): SubmittedArtifactDockerProfile {
  return {
    status: "skipped",
    dockerAvailable: false,
    image: IMAGE,
    profile: "docker_network_none_readonly_workspace_no_new_privileges",
    profileArgs: DOCKER_PROFILE_ARGS,
    controlProbeCount: 0,
    passedControlProbeCount: 0,
    probes: [],
    limitations: ["Docker profile probes were skipped for deterministic unit tests."]
  };
}

function unavailableDockerProfile(): SubmittedArtifactDockerProfile {
  return {
    status: "unavailable",
    dockerAvailable: false,
    image: IMAGE,
    profile: "docker_network_none_readonly_workspace_no_new_privileges",
    profileArgs: DOCKER_PROFILE_ARGS,
    controlProbeCount: 0,
    passedControlProbeCount: 0,
    probes: [],
    limitations: [
      "Docker is unavailable, so submitted artifact confinement is reported as unavailable instead of inferred.",
      "The deterministic benchmark remains runnable, but hardened-profile evidence must be generated on a Docker host."
    ]
  };
}

function parseDockerProbeStdout(stdout: string): DockerProfileProbe[] {
  try {
    return parseLastJsonLine<{ probes: DockerProfileProbe[] }>(stdout).probes;
  } catch {
    return [
      {
        id: "docker-probe-output-parse",
        expected: "parseable_probe_json",
        observed: "unparseable_probe_json",
        errorCode: "UNPARSEABLE_STDOUT",
        passed: false
      }
    ];
  }
}

async function runDockerProfileProbe(root: string): Promise<SubmittedArtifactDockerProfile> {
  const available = await dockerAvailable();
  if (!available) {
    return unavailableDockerProfile();
  }

  const artifactRoot = resolve(root, "examples/submitted_artifacts");
  const { server, port } = await listenOnHost();
  const tempHome = await mkdtemp(join(tmpdir(), "paisl-submitted-artifact-home-"));
  try {
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
      "PAISL_ARTIFACT_RUNNER=fixture",
      "--volume",
      `${artifactRoot}:/workspace:ro`,
      "--add-host=host.docker.internal:host-gateway",
      IMAGE,
      "node",
      "-e",
      DOCKER_PROBE_SOURCE,
      "host.docker.internal",
      String(port)
    ];
    const result = await new Promise<{ exitCode: number | null; stdout: string }>((resolveRun) => {
      const child = spawn("docker", dockerArgs, {
        cwd: tempHome,
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
    const probes = parseDockerProbeStdout(result.stdout);
    const passedControlProbeCount = probes.filter((probe) => probe.passed).length;
    const status = result.exitCode === 0 && passedControlProbeCount === probes.length ? "passed" : "failed";

    return {
      status,
      dockerAvailable: true,
      image: IMAGE,
      profile: "docker_network_none_readonly_workspace_no_new_privileges",
      profileArgs: DOCKER_PROFILE_ARGS,
      controlProbeCount: probes.length,
      passedControlProbeCount,
      probes,
      limitations: [
        "The Docker profile proves the probed controls for fixture artifacts, not complete production sandboxing.",
        "The probe covers network denial, read-only mounts, read-only root filesystem, controlled environment, and accepted hardening flags.",
        "It does not yet cover syscall filtering, GPU isolation, DNS policy beyond network none, package-install governance, timing side channels, or multi-tenant isolation."
      ]
    };
  } finally {
    await closeServer(server);
    await rm(tempHome, { recursive: true, force: true });
  }
}

async function executeSubmittedArtifact(
  artifact: LoadedSubmittedArtifact
): Promise<{ execution: SubmittedArtifactExecution; receipt: SubmissionReceipt }> {
  const artifactRun = await executeArtifact(artifact);
  const trace = artifactRun.trace;
  const traceMatchesManifest =
    trace?.traceId === artifact.manifest.expectedTraceId &&
    trace.scenarioId === artifact.manifest.scenarioId &&
    trace.systemName === artifact.manifest.systemName;
  const traceHash = trace ? sha256(JSON.stringify(trace)) : null;
  const brokerAttestation = trace ? brokerExternalTrace(trace) : null;
  const brokerVerification = brokerAttestation ? verifyBrokerAttestation(brokerAttestation) : null;
  const sandboxedAttestation = trace ? await runSandboxedTrace(trace) : null;
  const sandboxedVerification = sandboxedAttestation
    ? verifySandboxedExecutionAttestation(sandboxedAttestation)
    : null;
  const unsignedReceipt: Omit<SubmissionReceipt, "signature"> = {
    receiptId: `submission-receipt-${artifact.manifest.artifactId}`,
    artifactId: artifact.manifest.artifactId,
    runnerVersion: RUNNER_VERSION,
    generatedAt: GENERATED_AT,
    scenarioId: artifact.manifest.scenarioId,
    expectedTraceId: artifact.manifest.expectedTraceId,
    emittedTraceId: trace?.traceId ?? null,
    sourcePath: artifact.sourcePath,
    sourceSha256: artifact.sourceSha256,
    sourceBytes: artifact.sourceBytes,
    traceSha256: traceHash,
    brokerAttestationId: brokerAttestation?.attestationId ?? null,
    sandboxedExecutionAttestationId: sandboxedAttestation?.attestationId ?? null,
    passed:
      artifactRun.exitCode === 0 &&
      traceMatchesManifest &&
      brokerVerification?.valid === true &&
      sandboxedVerification?.valid === true &&
      sandboxedAttestation?.passed === true
  };
  const receipt = signReceipt(unsignedReceipt);
  const receiptVerification = verifySubmissionReceipt(receipt);

  return {
    receipt,
    execution: {
      artifactId: artifact.manifest.artifactId,
      sourcePath: artifact.sourcePath,
      sourceSha256: artifact.sourceSha256,
      artifactExitCode: artifactRun.exitCode,
      emittedTraceId: trace?.traceId ?? null,
      traceMatchesManifest,
      brokerSignatureValid: brokerVerification?.valid ?? false,
      brokerExecutedActionCount: brokerAttestation?.executedActionCount ?? 0,
      brokerBlockedActionCount: brokerAttestation?.blockedActionCount ?? 0,
      sandboxedExecutionPassed: sandboxedAttestation?.passed ?? false,
      sandboxedChildExecutedActionCount: sandboxedAttestation?.childExecutedActionCount ?? 0,
      sandboxedSkippedByBrokerCount: sandboxedAttestation?.skippedByBrokerCount ?? 0,
      receiptVerified: receiptVerification.valid,
      passed: unsignedReceipt.passed && receiptVerification.valid,
      limitations: [
        "This artifact is an author-provided fixture, not an independent external submission.",
        "The runner verifies emitted traces and source digests but cannot prove arbitrary hidden model reasoning.",
        "Sandboxed execution uses the existing fixture runner; Docker controls are reported separately."
      ]
    }
  };
}

export async function buildSubmittedArtifactRunnerReport(
  root: string,
  options: BuildOptions = {}
): Promise<SubmittedArtifactRunnerReport> {
  const { artifacts, sourcePaths } = await loadSubmittedArtifacts(root);
  const runs = await Promise.all(artifacts.map((artifact) => executeSubmittedArtifact(artifact)));
  const dockerProfile =
    options.runDockerProfile === false ? skippedDockerProfile() : await runDockerProfileProbe(root);
  const executions = runs.map((run) => run.execution);
  const receipts = runs.map((run) => run.receipt);

  return {
    benchmark: "personal-ai-sovereignty-benchmark",
    version: RUNNER_VERSION,
    generatedAt: GENERATED_AT,
    runnerMode: "submitted_artifact_contract_with_broker_and_sandbox_attestations",
    sourcePaths,
    submissionCount: artifacts.length,
    traceEmissionCount: executions.filter((execution) => execution.emittedTraceId !== null).length,
    signedReceiptCount: receipts.length,
    verifiedReceiptCount: receipts.filter((receipt) => verifySubmissionReceipt(receipt).valid).length,
    passedSubmissionCount: executions.filter((execution) => execution.passed).length,
    brokerExecutedActionCount: executions.reduce(
      (sum, execution) => sum + execution.brokerExecutedActionCount,
      0
    ),
    brokerBlockedActionCount: executions.reduce(
      (sum, execution) => sum + execution.brokerBlockedActionCount,
      0
    ),
    sandboxedExecutionPassedCount: executions.filter((execution) => execution.sandboxedExecutionPassed)
      .length,
    dockerProfile,
    receipts,
    executions,
    limitations: [
      "Submitted artifacts are checked-in fixtures, not independent external submissions.",
      "Fixture HMAC keys make receipts reproducible but not identity-bound.",
      "Docker controls are local hardened-profile probes, not production multi-tenant sandboxing.",
      "This is stronger than trace replay because source digests, emitted traces, broker attestations, and sandbox attestations are bound together, but it is still not independent external validation."
    ]
  };
}

export function renderSubmittedArtifactRunnerMarkdown(report: SubmittedArtifactRunnerReport): string {
  return `# Submitted Artifact Runner Report

Generated by \`pnpm eval\`.

## Summary

- Runner mode: \`${report.runnerMode}\`
- Submission count: ${report.submissionCount}
- Trace emissions: ${report.traceEmissionCount}
- Signed receipts: ${report.signedReceiptCount}
- Verified receipts: ${report.verifiedReceiptCount}
- Passed submissions: ${report.passedSubmissionCount}
- Broker-executed actions: ${report.brokerExecutedActionCount}
- Broker-blocked actions: ${report.brokerBlockedActionCount}
- Passed sandboxed executions: ${report.sandboxedExecutionPassedCount}

## Submitted Artifacts

| Artifact | Source | Digest | Exit | Trace | Broker Executed | Broker Blocked | Sandboxed Passed | Receipt | Result |
| --- | --- | --- | ---: | --- | ---: | ---: | --- | --- | --- |
${report.executions
  .map(
    (execution) =>
      `| ${execution.artifactId} | \`${execution.sourcePath}\` | \`${execution.sourceSha256.slice(
        0,
        12
      )}\` | ${execution.artifactExitCode ?? "null"} | ${execution.emittedTraceId ?? "none"} | ${
        execution.brokerExecutedActionCount
      } | ${execution.brokerBlockedActionCount} | ${execution.sandboxedExecutionPassed} | ${
        execution.receiptVerified ? "verified" : "invalid"
      } | ${execution.passed ? "pass" : "fail"} |`
  )
  .join("\n")}

## Docker Hardened Profile

- Status: \`${report.dockerProfile.status}\`
- Docker available: ${report.dockerProfile.dockerAvailable}
- Image: \`${report.dockerProfile.image}\`
- Profile: \`${report.dockerProfile.profile}\`
- Control probes: ${report.dockerProfile.passedControlProbeCount}/${report.dockerProfile.controlProbeCount}
- Profile args: ${report.dockerProfile.profileArgs.map((arg) => `\`${arg}\``).join(", ")}

| Probe | Expected | Observed | Error | Result |
| --- | --- | --- | --- | --- |
${report.dockerProfile.probes
  .map(
    (probe) =>
      `| ${probe.id} | ${probe.expected} | ${probe.observed} | ${probe.errorCode ?? "none"} | ${
        probe.passed ? "pass" : "fail"
      } |`
  )
  .join("\n") || "| none | not_run | not_run | none | skipped |"}

## Receipt Binding

| Receipt | Artifact | Source SHA-256 | Trace SHA-256 | Broker Attestation | Sandboxed Attestation | Signature |
| --- | --- | --- | --- | --- | --- | --- |
${report.receipts
  .map(
    (receipt) =>
      `| ${receipt.receiptId} | ${receipt.artifactId} | \`${receipt.sourceSha256}\` | \`${
        receipt.traceSha256 ?? "none"
      }\` | ${receipt.brokerAttestationId ?? "none"} | ${
        receipt.sandboxedExecutionAttestationId ?? "none"
      } | ${verifySubmissionReceipt(receipt).valid ? "valid" : "invalid"} |`
  )
  .join("\n")}

## Interpretation

The submitted-system evidence path uses executable fixture artifacts rather than checked-in trace files alone. Each artifact emits a trace, the runner binds the source digest and emitted trace to a signed receipt, then the existing broker and sandboxed trace runner attest the boundary decisions. The Docker hardened-profile probe adds local evidence for network-none, read-only filesystem, read-only workspace, controlled environment, and hardening flag acceptance when Docker is available.

## Limitations

${report.limitations.map((limitation) => `- ${limitation}`).join("\n")}

## Docker Profile Limitations

${report.dockerProfile.limitations.map((limitation) => `- ${limitation}`).join("\n")}
`;
}
