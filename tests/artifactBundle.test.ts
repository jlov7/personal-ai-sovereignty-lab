import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildArtifactBundleVerificationReport,
  buildArtifactTransparencyLedgerReport,
  verifyArtifactBundleDirectory
} from "../src/evals/artifactBundle";
import { buildSubmittedArtifactRunnerReport } from "../src/evals/submittedArtifactRunnerReport";

describe("artifact bundle standard", () => {
  it("verifies safe and unsafe seed bundles while rejecting malformed fixtures", async () => {
    // Opt into entrypoint execution (off by default for untrusted-bundle safety)
    // so the execution-derived checks (e.g. unexpected-writes) are exercised.
    const report = await buildArtifactBundleVerificationReport(process.cwd(), {
      executeEntrypoints: true
    });

    expect(report.status).toBe("passed");
    expect(report.bundleCount).toBe(3);
    expect(report.passedBundleCount).toBe(2);
    expect(report.rejectedBundleCount).toBe(1);

    const safe = report.bundles.find((bundle) => bundle.artifactId === "safe-minimized-agent");
    const unsafe = report.bundles.find((bundle) => bundle.artifactId === "raw-upload-agent");
    const malformed = report.bundles.find(
      (bundle) => bundle.artifactId === "malformed-unexpected-write-agent"
    );

    expect(safe?.verificationStatus).toBe("pass");
    expect(unsafe?.verificationStatus).toBe("pass");
    expect(malformed?.verificationStatus).toBe("fail");
    expect(malformed?.checks.some((check) => check.id === "claim-boundaries-present")).toBe(true);
    expect(malformed?.checks.some((check) => check.id === "runtime-pinned")).toBe(true);
    expect(malformed?.checks.some((check) => check.id === "unexpected-writes")).toBe(true);
  });

  it("rejects source digest mismatches", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "paisl-bundle-test-"));
    try {
      const fixturePath = resolve(process.cwd(), "examples/artifact_bundles/safe-minimized-agent");
      const copiedPath = resolve(tempRoot, "safe-minimized-agent");
      await cp(fixturePath, copiedPath, { recursive: true });
      await writeFile(
        resolve(copiedPath, "agent.mjs"),
        `${await readFile(resolve(copiedPath, "agent.mjs"), "utf8")}\nprocess.stderr.write(\"tampered\");\n`
      );

      const verification = await verifyArtifactBundleDirectory(tempRoot, copiedPath);

      expect(verification.verificationStatus).toBe("fail");
      expect(
        verification.checks.find((check) => check.id === "source-digest:agent.mjs")?.passed
      ).toBe(false);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("rejects path traversal before resolving or reading declared source paths", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "paisl-bundle-path-test-"));
    try {
      const fixturePath = resolve(process.cwd(), "examples/artifact_bundles/safe-minimized-agent");
      const copiedPath = resolve(tempRoot, "safe-minimized-agent");
      await cp(fixturePath, copiedPath, { recursive: true });
      await writeFile(resolve(tempRoot, "outside.txt"), "host-adjacent file the verifier must not inspect");

      const manifestPath = resolve(copiedPath, "bundle.json");
      const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
        sourceDigests: Array<{ path: string; sha256: string; bytes: number; role: string }>;
      };
      manifest.sourceDigests = [
        {
          ...manifest.sourceDigests[0],
          path: "../outside.txt"
        }
      ];
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

      const verification = await verifyArtifactBundleDirectory(tempRoot, copiedPath, null, true);

      expect(verification.verificationStatus).toBe("fail");
      expect(verification.checks.find((check) => check.id === "manifest-paths-contained")?.passed).toBe(false);
      expect(verification.checks.some((check) => check.id === "source-digest:../outside.txt")).toBe(false);
      expect(verification.sourcePaths.some((path) => path.includes("outside.txt"))).toBe(false);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("chains submitted-artifact receipts into a tamper-evident transparency ledger", async () => {
    const bundleReport = await buildArtifactBundleVerificationReport(process.cwd());
    const runnerReport = await buildSubmittedArtifactRunnerReport(process.cwd(), {
      runDockerProfile: false
    });
    const ledgerReport = buildArtifactTransparencyLedgerReport(bundleReport, runnerReport);

    expect(ledgerReport.integrity.valid).toBe(true);
    expect(ledgerReport.entryCount).toBe(runnerReport.receipts.length);
    expect(ledgerReport.chainHead).toMatch(/^[a-f0-9]{64}$/);
    expect(ledgerReport.tamperProbe.originalValid).toBe(true);
    expect(ledgerReport.tamperProbe.tamperedValid).toBe(false);
    expect(ledgerReport.tamperProbe.detected).toBe(true);
  });
});
