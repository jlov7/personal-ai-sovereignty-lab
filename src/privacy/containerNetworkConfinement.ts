import { spawn } from "node:child_process";
import net from "node:net";

export interface ContainerNetworkProbeAttempt {
  id: string;
  dockerArgs: string[];
  expectedConnected: boolean;
  observedConnected: boolean;
  errorCode: string | null;
  exitCode: number | null;
  passed: boolean;
}

export interface ContainerNetworkConfinementReport {
  benchmark: string;
  version: string;
  generatedAt: string;
  platform: NodeJS.Platform;
  confinementLayer: "docker_network_none";
  status: "passed" | "unavailable" | "failed";
  dockerAvailable: boolean;
  image: "node:24-alpine";
  probeHostBinding: "0.0.0.0";
  probeTargetHost: "host.docker.internal";
  positiveControlPassed: boolean;
  containerDeniedNetwork: boolean;
  attempts: ContainerNetworkProbeAttempt[];
  limitations: string[];
}

const GENERATED_AT = new Date("2026-05-23T00:00:00.000Z").toISOString();
const IMAGE = "node:24-alpine";
const TARGET_HOST = "host.docker.internal";
const CHILD_SOURCE = `
const net = require("node:net");
const host = process.argv[1];
const port = Number(process.argv[2]);
const socket = net.createConnection({ host, port });
socket.setTimeout(3000);
socket.on("connect", () => {
  process.stdout.write(JSON.stringify({ connected: true, errorCode: null }) + "\\n");
  socket.destroy();
});
socket.on("error", (error) => {
  process.stdout.write(JSON.stringify({ connected: false, errorCode: error && error.code ? error.code : "ERROR" }) + "\\n");
});
socket.on("timeout", () => {
  process.stdout.write(JSON.stringify({ connected: false, errorCode: "TIMEOUT" }) + "\\n");
  socket.destroy();
});
`;

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
    throw new Error("Could not allocate host TCP port for container confinement probe");
  }
  return { server, port: address.port };
}

function closeServer(server: net.Server): Promise<void> {
  return new Promise((resolveClose, reject) => {
    server.close((error) => (error ? reject(error) : resolveClose()));
  });
}

function parseProbeStdout(stdout: string, exitCode: number | null): { connected: boolean; errorCode: string | null } {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return { connected: false, errorCode: exitCode === 0 ? "NO_STDOUT" : `DOCKER_EXIT_${exitCode ?? "null"}` };
  }
  const lastLine = trimmed.split("\n").at(-1);
  if (!lastLine) {
    return { connected: false, errorCode: "NO_STDOUT" };
  }
  try {
    return JSON.parse(lastLine) as { connected: boolean; errorCode: string | null };
  } catch {
    return { connected: false, errorCode: "UNPARSEABLE_STDOUT" };
  }
}

function runDockerAttempt(
  id: string,
  dockerArgs: string[],
  expectedConnected: boolean
): Promise<ContainerNetworkProbeAttempt> {
  return new Promise((resolveAttempt) => {
    const child = spawn("docker", dockerArgs, { stdio: ["ignore", "pipe", "pipe"] });
    const stdoutChunks: Buffer[] = [];
    let settled = false;
    const finish = (exitCode: number | null) => {
      if (settled) {
        return;
      }
      settled = true;
      const parsed = parseProbeStdout(Buffer.concat(stdoutChunks).toString("utf8"), exitCode);
      resolveAttempt({
        id,
        dockerArgs: dockerArgs.map((arg) => {
          if (arg.match(/^[0-9]+$/)) {
            return "<ephemeral-port>";
          }
          if (arg.includes("\n")) {
            return "<probe-script>";
          }
          return arg;
        }),
        expectedConnected,
        observedConnected: parsed.connected,
        errorCode: parsed.errorCode,
        exitCode,
        passed: parsed.connected === expectedConnected
      });
    };
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      finish(null);
    }, 10000);
    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.on("error", () => {
      clearTimeout(timeout);
      finish(null);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      finish(code);
    });
  });
}

function dockerArgsFor(port: number, networkNone: boolean): string[] {
  return [
    "run",
    "--rm",
    ...(networkNone ? ["--network", "none"] : []),
    "--add-host=host.docker.internal:host-gateway",
    IMAGE,
    "node",
    "-e",
    CHILD_SOURCE,
    TARGET_HOST,
    String(port)
  ];
}

export async function runContainerNetworkConfinementProbe(): Promise<ContainerNetworkConfinementReport> {
  const available = await dockerAvailable();
  if (!available) {
    return {
      benchmark: "personal-ai-sovereignty-benchmark",
      version: "0.14.0-container-network-confinement",
      generatedAt: GENERATED_AT,
      platform: process.platform,
      confinementLayer: "docker_network_none",
      status: "unavailable",
      dockerAvailable: false,
      image: IMAGE,
      probeHostBinding: "0.0.0.0",
      probeTargetHost: TARGET_HOST,
      positiveControlPassed: false,
      containerDeniedNetwork: false,
      attempts: [],
      limitations: [
        "This probe requires a local Docker daemon and is intentionally run as a separate enforcement check.",
        "The deterministic benchmark harness remains runnable without Docker."
      ]
    };
  }

  const { server, port } = await listenOnHost();
  try {
    const positive = await runDockerAttempt(
      "container-host-network-positive-control",
      dockerArgsFor(port, false),
      true
    );
    const denied = await runDockerAttempt(
      "container-network-none-denies-host-egress",
      dockerArgsFor(port, true),
      false
    );
    const positiveControlPassed = positive.passed;
    const containerDeniedNetwork = denied.passed;

    return {
      benchmark: "personal-ai-sovereignty-benchmark",
      version: "0.14.0-container-network-confinement",
      generatedAt: GENERATED_AT,
      platform: process.platform,
      confinementLayer: "docker_network_none",
      status: positiveControlPassed && containerDeniedNetwork ? "passed" : "failed",
      dockerAvailable: true,
      image: IMAGE,
      probeHostBinding: "0.0.0.0",
      probeTargetHost: TARGET_HOST,
      positiveControlPassed,
      containerDeniedNetwork,
      attempts: [positive, denied],
      limitations: [
        "This proves Docker network isolation for the probed container process, not a complete production agent sandbox.",
        "The probe covers host TCP egress through Docker networking; filesystem, IPC, GPU, DNS policy, package installation, and side-channel controls require separate tests.",
        "The benchmark still needs production broker integration before runtime confinement should be treated as deployable security."
      ]
    };
  } finally {
    await closeServer(server);
  }
}

export function renderContainerNetworkConfinementMarkdown(
  report: ContainerNetworkConfinementReport
): string {
  return `# Container Network Confinement Probe

Generated by \`pnpm confinement:container\`.

## Summary

- Platform: \`${report.platform}\`
- Confinement layer: \`${report.confinementLayer}\`
- Status: \`${report.status}\`
- Docker available: ${report.dockerAvailable}
- Image: \`${report.image}\`
- Host binding: \`${report.probeHostBinding}\`
- Target host from container: \`${report.probeTargetHost}\`
- Positive control passed: ${report.positiveControlPassed}
- Container denied network: ${report.containerDeniedNetwork}

## Attempts

| Attempt | Expected Connected | Observed Connected | Error Code | Exit Code | Result |
| --- | --- | --- | --- | ---: | --- |
${report.attempts
  .map(
    (attempt) =>
      `| ${attempt.id} | ${attempt.expectedConnected} | ${attempt.observedConnected} | ${
        attempt.errorCode ?? "none"
      } | ${attempt.exitCode ?? "null"} | ${attempt.passed ? "pass" : "fail"} |`
  )
  .join("\n")}

## Interpretation

This is the Linux/container counterpart to the macOS sandbox probe. The positive control proves the container can reach a host TCP server when normal Docker networking is enabled. The negative control repeats the same code under \`--network none\`, where the host connection must fail.

## Limitations

${report.limitations.map((limitation) => `- ${limitation}`).join("\n")}
`;
}
