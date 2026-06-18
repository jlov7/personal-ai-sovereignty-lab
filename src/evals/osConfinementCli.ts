import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  renderOSNetworkConfinementMarkdown,
  runOSNetworkConfinementProbe
} from "../privacy/osNetworkConfinement";

const shouldWrite = process.argv.includes("--write");

const report = await runOSNetworkConfinementProbe();

if (shouldWrite) {
  await mkdir(resolve("outputs"), { recursive: true });
  await writeFile(
    resolve("outputs/os_network_confinement_probe.json"),
    `${JSON.stringify(report, null, 2)}\n`
  );
  await writeFile(
    resolve("outputs/os_network_confinement_probe.md"),
    renderOSNetworkConfinementMarkdown(report)
  );
} else {
  process.stdout.write(`${renderOSNetworkConfinementMarkdown(report)}\n`);
}

if (report.status !== "passed") {
  process.exitCode = 1;
}
