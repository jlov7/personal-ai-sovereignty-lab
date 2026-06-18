import { describe, expect, it } from "vitest";
import { buildSignedConsentReport } from "../src/evals/signedConsentReport";
import { scenarios } from "../src/scenarios/library";

describe("signed consent receipts", () => {
  it("separates signature integrity from scoped policy validity", () => {
    const report = buildSignedConsentReport(scenarios);

    expect(report.failed).toBe(0);
    expect(report.probeCount).toBe(4);
    expect(report.probes.find((probe) => probe.id.includes("tampered"))?.observedValidSignature).toBe(false);
    expect(report.probes.find((probe) => probe.id.includes("scope-mismatch"))?.observedValidSignature).toBe(true);
    expect(report.probes.find((probe) => probe.id.includes("scope-mismatch"))?.observedAllowedEgress).toBe(false);
    expect(report.limitations.join(" ")).toContain("not production key custody");
  });
});
