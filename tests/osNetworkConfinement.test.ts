import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { runOSNetworkConfinementProbe } from "../src/privacy/osNetworkConfinement";

const canRunMacOSSandboxProbe = process.platform === "darwin" && existsSync("/usr/bin/sandbox-exec");
const maybeIt = canRunMacOSSandboxProbe ? it : it.skip;

describe("OS network confinement", () => {
  maybeIt("denies loopback network access under the macOS sandbox profile", async () => {
    const report = await runOSNetworkConfinementProbe();

    expect(report.status).toBe("passed");
    expect(report.positiveControlPassed).toBe(true);
    expect(report.sandboxDeniedNetwork).toBe(true);
    expect(report.attempts.find((attempt) => attempt.id === "sandbox-denies-loopback-network")?.errorCode).toBe(
      "EPERM"
    );
  });
});
