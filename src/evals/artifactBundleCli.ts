import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  buildArtifactBundleVerificationReport,
  buildArtifactTransparencyLedgerReport,
  renderArtifactBundleVerificationMarkdown,
  renderArtifactTransparencyLedgerMarkdown
} from "./artifactBundle";
import { buildSubmittedArtifactRunnerReport } from "./submittedArtifactRunnerReport";

const shouldWrite = process.argv.includes("--write");
const bundleReport = await buildArtifactBundleVerificationReport(process.cwd());
const runnerReport = await buildSubmittedArtifactRunnerReport(process.cwd(), {
  runDockerProfile: false
});
const ledgerReport = buildArtifactTransparencyLedgerReport(bundleReport, runnerReport);

if (shouldWrite) {
  await mkdir(resolve("outputs"), { recursive: true });
  await writeFile(
    resolve("outputs/artifact_bundle_verification_report.json"),
    `${JSON.stringify(bundleReport, null, 2)}\n`
  );
  await writeFile(
    resolve("outputs/artifact_bundle_verification_report.md"),
    renderArtifactBundleVerificationMarkdown(bundleReport)
  );
  await writeFile(
    resolve("outputs/artifact_transparency_ledger_report.json"),
    `${JSON.stringify(ledgerReport, null, 2)}\n`
  );
  await writeFile(
    resolve("outputs/artifact_transparency_ledger_report.md"),
    renderArtifactTransparencyLedgerMarkdown(ledgerReport)
  );
} else {
  process.stdout.write(`${renderArtifactBundleVerificationMarkdown(bundleReport)}\n`);
  process.stdout.write(`${renderArtifactTransparencyLedgerMarkdown(ledgerReport)}\n`);
}

if (bundleReport.status !== "passed" || !ledgerReport.integrity.valid || !ledgerReport.tamperProbe.detected) {
  process.exitCode = 1;
}
