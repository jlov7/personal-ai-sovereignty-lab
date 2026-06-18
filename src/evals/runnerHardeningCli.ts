import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildRunnerHardeningReport, renderRunnerHardeningMarkdown } from "./runnerHardeningReport";

const shouldWrite = process.argv.includes("--write");
const report = await buildRunnerHardeningReport(process.cwd());

if (shouldWrite) {
  await mkdir(resolve("outputs"), { recursive: true });
  await writeFile(resolve("outputs/runner_hardening_report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(resolve("outputs/runner_hardening_report.md"), renderRunnerHardeningMarkdown(report));
} else {
  process.stdout.write(`${renderRunnerHardeningMarkdown(report)}\n`);
}

// A green exit must mean hardening was actually verified. "unavailable" or
// "skipped" (e.g. no Docker on this host) is NOT evidence of enforcement, so it
// fails the check rather than masquerading as a pass.
if (report.status !== "passed") {
  process.stderr.write(
    `runner hardening status: ${report.status} (Docker available: ${report.dockerAvailable}). ` +
      `Only "passed" is evidence of enforcement; "${report.status}" means the probes did not run here.\n`
  );
  process.exitCode = 1;
}
