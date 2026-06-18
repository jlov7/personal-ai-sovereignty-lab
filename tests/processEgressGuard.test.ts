import { describe, expect, it } from "vitest";
import { buildProcessEgressGuardReport } from "../src/evals/processEgressGuardReport";

describe("process-level egress guard", () => {
  it("blocks untrusted fetch/http/https and raw socket egress in a guarded child process", async () => {
    const report = await buildProcessEgressGuardReport();

    expect(report.failed).toBe(0);
    expect(report.passed).toBe(report.probeCount);
    expect(report.auditEventCount).toBe(9);
    expect(report.probes.find((probe) => probe.id === "fetch-allowed-host")?.observedAllowed).toBe(true);
    expect(report.probes.find((probe) => probe.id === "fetch-untrusted-host")?.observedAllowed).toBe(false);
    expect(report.probes.find((probe) => probe.id === "http-untrusted-host")?.observedAllowed).toBe(false);
    expect(report.probes.find((probe) => probe.id === "http-get-untrusted-host")?.observedAllowed).toBe(false);
    expect(report.probes.find((probe) => probe.id === "https-untrusted-host")?.observedAllowed).toBe(false);
    expect(report.probes.find((probe) => probe.id === "https-get-untrusted-host")?.observedAllowed).toBe(false);
    expect(report.probes.find((probe) => probe.id === "net-raw-socket-allowed-host")?.reason).toBe(
      "raw_socket_denied_even_when_host_is_allowed"
    );
    expect(report.probes.find((probe) => probe.id === "net-create-connection-allowed-host")?.reason).toBe(
      "raw_socket_denied_even_when_host_is_allowed"
    );
    expect(report.limitations.join(" ")).toContain("not a kernel firewall");
  });
});
