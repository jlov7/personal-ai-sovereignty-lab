import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  buildSubmittedArtifactRunnerReport,
  renderSubmittedArtifactRunnerMarkdown
} from "./submittedArtifactRunnerReport";

const shouldWrite = process.argv.includes("--write");
const report = await buildSubmittedArtifactRunnerReport(process.cwd());

if (shouldWrite) {
  await mkdir(resolve("outputs"), { recursive: true });
  await writeFile(
    resolve("outputs/submitted_artifact_runner_report.json"),
    `${JSON.stringify(report, null, 2)}\n`
  );
  await writeFile(
    resolve("outputs/submitted_artifact_runner_report.md"),
    renderSubmittedArtifactRunnerMarkdown(report)
  );
} else {
  process.stdout.write(`${renderSubmittedArtifactRunnerMarkdown(report)}\n`);
}

if (report.dockerProfile.status === "failed" || report.passedSubmissionCount !== report.submissionCount) {
  process.exitCode = 1;
}
