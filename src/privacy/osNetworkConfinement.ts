import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface OSNetworkProbeAttempt {
  id: string;
  command: "node" | "sandbox-exec";
  expectedConnected: boolean;
  observedConnected: boolean;
  errorCode: string | null;
  passed: boolean;
}

export interface OSNetworkConfinementReport {
  benchmark: string;
  version: string;
  generatedAt: string;
  platform: NodeJS.Platform;
  confinementLayer: "macos_sandbox_exec";
  status: "passed" | "unavailable" | "failed";
  sandboxAvailable: boolean;
  probeHost: "127.0.0.1";
  positiveControlPassed: boolean;
  sandboxDeniedNetwork: boolean;
  attempts: OSNetworkProbeAttempt[];
  limitations: string[];
}

const CHILD_SOURCE = `
import net from "node:net";

const port = Number(process.argv[2]);
const socket = net.createConnection({ host: "127.0.0.1", port });
socket.setTimeout(1000);
socket.on("connect", () => {
  process.stdout.write(JSON.stringify({ connected: true, errorCode: null }) + "\\n");
  socket.destroy();
});
socket.on("error", (error) => {
  process.stdout.write(JSON.stringify({ connected: false, errorCode: error?.code ?? "ERROR" }) + "\\n");
});
socket.on("timeout", () => {
  process.stdout.write(JSON.stringify({ connected: false, errorCode: "TIMEOUT" }) + "\\n");
  socket.destroy();
});
`;

async function listenOnLoopback(): Promise<{ server: net.Server; port: number }> {
  const server = net.createServer((socket) => {
    socket.on("error", () => undefined);
    socket.end("ok");
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not allocate loopback TCP port for OS confinement probe");
  }
  return { server, port: address.port };
}

function closeServer(server: net.Server): Promise<void> {
  return new Promise((resolveClose, reject) => {
    server.close((error) => (error ? reject(error) : resolveClose()));
  });
}

function runCommand(
  id: string,
  command: "node" | "sandbox-exec",
  args: string[],
  expectedConnected: boolean
): Promise<OSNetworkProbeAttempt> {
  return new Promise((resolveAttempt) => {
    const child = spawn(command === "node" ? process.execPath : "/usr/bin/sandbox-exec", args, {
      stdio: ["ignore", "pipe", "pipe"]
    });
    const stdoutChunks: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.on("close", () => {
      const stdout = Buffer.concat(stdoutChunks).toString("utf8").trim();
      const parsed = stdout
        ? (JSON.parse(stdout) as { connected: boolean; errorCode: string | null })
        : { connected: false, errorCode: "NO_STDOUT" };
      resolveAttempt({
        id,
        command,
        expectedConnected,
        observedConnected: parsed.connected,
        errorCode: parsed.errorCode,
        passed: parsed.connected === expectedConnected
      });
    });
  });
}

export async function runOSNetworkConfinementProbe(): Promise<OSNetworkConfinementReport> {
  const sandboxAvailable = process.platform === "darwin" && existsSync("/usr/bin/sandbox-exec");
  if (!sandboxAvailable) {
    return {
      benchmark: "personal-ai-sovereignty-benchmark",
      version: "0.14.0-os-network-confinement",
      generatedAt: new Date("2026-05-23T00:00:00.000Z").toISOString(),
      platform: process.platform,
      confinementLayer: "macos_sandbox_exec",
      status: "unavailable",
      sandboxAvailable: false,
      probeHost: "127.0.0.1",
      positiveControlPassed: false,
      sandboxDeniedNetwork: false,
      attempts: [],
      limitations: [
        "This probe requires macOS sandbox-exec and is intentionally not run by pnpm eval on Linux CI.",
        "The main benchmark artifact set remains deterministic; the macOS workflow runs this probe as separate public enforcement evidence."
      ]
    };
  }

  const dir = await mkdtemp(join(tmpdir(), "paisl-os-confinement-"));
  const childPath = join(dir, "loopback-probe.mjs");
  await writeFile(childPath, CHILD_SOURCE);

  const { server, port } = await listenOnLoopback();
  try {
    const positive = await runCommand(
      "unsandboxed-loopback-positive-control",
      "node",
      [childPath, String(port)],
      true
    );
    const sandboxed = await runCommand(
      "sandbox-denies-loopback-network",
      "sandbox-exec",
      [
        "-p",
        "(version 1) (allow default) (deny network*)",
        process.execPath,
        childPath,
        String(port)
      ],
      false
    );
    const positiveControlPassed = positive.passed;
    const sandboxDeniedNetwork = sandboxed.passed && sandboxed.errorCode === "EPERM";

    return {
      benchmark: "personal-ai-sovereignty-benchmark",
      version: "0.14.0-os-network-confinement",
      generatedAt: new Date("2026-05-23T00:00:00.000Z").toISOString(),
      platform: process.platform,
      confinementLayer: "macos_sandbox_exec",
      status: positiveControlPassed && sandboxDeniedNetwork ? "passed" : "failed",
      sandboxAvailable,
      probeHost: "127.0.0.1",
      positiveControlPassed,
      sandboxDeniedNetwork,
      attempts: [positive, sandboxed],
      limitations: [
        "This is an OS-level macOS sandbox experiment against a local loopback TCP server, not a production broker or full container policy.",
        "It proves the sandbox profile can deny network access for the probed child process; it does not prove all future agent execution paths are confined.",
        "Linux/container confinement is covered by the separate Docker network-none probe; production broker integration still needs additional work."
      ]
    };
  } finally {
    await closeServer(server);
    await rm(dir, { recursive: true, force: true });
  }
}

export function renderOSNetworkConfinementMarkdown(report: OSNetworkConfinementReport): string {
  return `# OS Network Confinement Probe

Generated by \`pnpm confinement:probe\`.

## Summary

- Platform: \`${report.platform}\`
- Confinement layer: \`${report.confinementLayer}\`
- Status: \`${report.status}\`
- Sandbox available: ${report.sandboxAvailable}
- Positive control passed: ${report.positiveControlPassed}
- Sandbox denied network: ${report.sandboxDeniedNetwork}

## Attempts

| Attempt | Command | Expected Connected | Observed Connected | Error Code | Result |
| --- | --- | --- | --- | --- | --- |
${report.attempts
  .map(
    (attempt) =>
      `| ${attempt.id} | ${attempt.command} | ${attempt.expectedConnected} | ${attempt.observedConnected} | ${attempt.errorCode ?? "none"} | ${
        attempt.passed ? "pass" : "fail"
      } |`
  )
  .join("\n")}

## Interpretation

This probe is deliberately stronger than Node preload instrumentation. It uses the operating system sandbox to deny network operations for a child process, with an unsandboxed loopback connection as the positive control. The benchmark still treats this as an experiment, not a complete product confinement system.

## Limitations

${report.limitations.map((limitation) => `- ${limitation}`).join("\n")}
`;
}
