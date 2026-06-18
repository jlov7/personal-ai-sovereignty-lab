import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

export interface ProcessEgressAuditEvent {
  api: string;
  host: string;
  allowed: boolean;
  reason: string;
}

export interface ProcessEgressProbe {
  id: string;
  api: string;
  expectedAllowed: boolean;
  observedAllowed: boolean;
  passed: boolean;
  reason: string;
}

export interface ProcessEgressGuardRun {
  childExitCode: number | null;
  childStdout: string;
  childStderr: string;
  auditEvents: ProcessEgressAuditEvent[];
  probes: ProcessEgressProbe[];
}

const PRELOAD_SOURCE = `
import { appendFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";

const auditPath = process.env.PAISL_PROCESS_EGRESS_AUDIT;
const allowHosts = new Set(
  (process.env.PAISL_PROCESS_EGRESS_ALLOW_HOSTS || "")
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
  const error = new Error("PAISL process egress denied by runtime guard: " + api + " " + host);
  error.code = "PAISL_EGRESS_DENIED";
  throw error;
}

function hostFromUrlLike(input, options) {
  if (typeof input === "string" || input instanceof URL) {
    const parsed = new URL(input.toString());
    return parsed.host;
  }
  if (input && typeof input === "object" && "href" in input) {
    return new URL(input.href).host;
  }
  const candidate = options && typeof options === "object" ? options : input;
  const host = candidate?.hostname || candidate?.host || "unknown-host";
  const port = candidate?.port ? ":" + candidate.port : "";
  return String(host).includes(":") ? String(host) : String(host) + port;
}

function assertHostAllowed(api, host) {
  if (!allowHosts.has(host)) {
    denied(api, host, "host_not_in_process_allowlist");
  }
  audit(api, host, true, "host_allowed_by_process_guard");
}

globalThis.fetch = async function paislGuardedFetch(input, init) {
  const url = typeof input === "string" || input instanceof URL ? input.toString() : input.url;
  const host = new URL(url).host;
  assertHostAllowed("fetch", host);
  return new Response("process guard accepted synthetic request", { status: 202 });
};

function patchHttpModule(module, moduleName) {
  module.request = function guardedRequest(input, options) {
    const host = hostFromUrlLike(input, options);
    assertHostAllowed(moduleName + ".request", host);
    denied(moduleName + ".request", host, "synthetic_guard_does_not_execute_real_network");
  };
  module.get = function guardedGet(input, options) {
    const host = hostFromUrlLike(input, options);
    assertHostAllowed(moduleName + ".get", host);
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
import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";

async function attempt(id, fn) {
  try {
    await fn();
    return { id, allowed: true, errorCode: null };
  } catch (error) {
    return { id, allowed: false, errorCode: error?.code ?? "ERROR" };
  }
}

const results = [];
results.push(await attempt("fetch-allowed-host", () =>
  fetch("https://provider.example/negotiation", { method: "POST", body: "{}" })
));
results.push(await attempt("fetch-untrusted-host", () =>
  fetch("https://untrusted.example/negotiation", { method: "POST", body: "{}" })
));
results.push(await attempt("http-untrusted-host", () =>
  http.request("http://untrusted.example/egress")
));
results.push(await attempt("http-get-untrusted-host", () =>
  http.get("http://untrusted.example/egress")
));
results.push(await attempt("https-untrusted-host", () =>
  https.request("https://untrusted.example/egress")
));
results.push(await attempt("https-get-untrusted-host", () =>
  https.get("https://untrusted.example/egress")
));
results.push(await attempt("net-raw-socket-allowed-host", () =>
  net.connect({ host: "provider.example", port: 443 })
));
results.push(await attempt("net-create-connection-allowed-host", () =>
  net.createConnection({ host: "provider.example", port: 443 })
));
results.push(await attempt("tls-raw-socket-allowed-host", () =>
  tls.connect({ host: "provider.example", port: 443 })
));

process.stdout.write(JSON.stringify({ results }) + "\\n");
`;

function parseJsonl(contents: string): ProcessEgressAuditEvent[] {
  return contents
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as ProcessEgressAuditEvent);
}

function probeFromChildResult(
  result: { id: string; allowed: boolean },
  auditEvents: ProcessEgressAuditEvent[]
): ProcessEgressProbe {
  const expectedAllowed = result.id === "fetch-allowed-host";
  const expectedHost = result.id.includes("untrusted") ? "untrusted.example" : "provider.example";
  const event = auditEvents.find((candidate) => {
    if (candidate.host !== expectedHost) return false;
    if (result.id.startsWith("fetch")) return candidate.api === "fetch";
    if (result.id.startsWith("http-get-")) return candidate.api === "http.get";
    if (result.id.startsWith("http-")) return candidate.api === "http.request";
    if (result.id.startsWith("https-get-")) return candidate.api === "https.get";
    if (result.id.startsWith("https-")) return candidate.api === "https.request";
    if (result.id.startsWith("net-create-connection-")) return candidate.api === "net.createConnection";
    if (result.id.startsWith("net-")) return candidate.api === "net.connect";
    if (result.id.startsWith("tls-")) return candidate.api === "tls.connect";
    return false;
  });

  return {
    id: result.id,
    api: event?.api ?? "unknown",
    expectedAllowed,
    observedAllowed: result.allowed,
    passed: result.allowed === expectedAllowed,
    reason: event?.reason ?? "missing_audit_event"
  };
}

export async function runProcessEgressGuard(): Promise<ProcessEgressGuardRun> {
  const dir = await mkdtemp(join(tmpdir(), "paisl-process-egress-"));
  try {
    const preloadPath = join(dir, "paisl-process-egress-preload.mjs");
    const auditPath = join(dir, "process-egress-audit.jsonl");
    await writeFile(preloadPath, PRELOAD_SOURCE);
    await writeFile(auditPath, "");

    const child = spawn(process.execPath, ["--import", preloadPath, "--input-type=module", "-e", CHILD_SOURCE], {
      cwd: resolve("."),
      env: {
        ...process.env,
        PAISL_PROCESS_EGRESS_AUDIT: auditPath,
        PAISL_PROCESS_EGRESS_ALLOW_HOSTS: "provider.example"
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

    const childExitCode = await new Promise<number | null>((resolveExit) => {
      child.on("close", (code) => resolveExit(code));
    });
    const childStdout = Buffer.concat(stdoutChunks).toString("utf8");
    const childStderr = Buffer.concat(stderrChunks).toString("utf8");
    const auditEvents = parseJsonl(await readFile(auditPath, "utf8"));
    const parsed = JSON.parse(childStdout.trim()) as {
      results: Array<{ id: string; allowed: boolean; errorCode: string | null }>;
    };

    return {
      childExitCode,
      childStdout,
      childStderr,
      auditEvents,
      probes: parsed.results.map((result) => probeFromChildResult(result, auditEvents))
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
