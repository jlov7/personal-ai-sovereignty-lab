import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  renderContainerNetworkConfinementMarkdown,
  runContainerNetworkConfinementProbe
} from "../privacy/containerNetworkConfinement";

const shouldWrite = process.argv.includes("--write");

const report = await runContainerNetworkConfinementProbe();

if (shouldWrite) {
  await mkdir(resolve("outputs"), { recursive: true });
  await writeFile(
    resolve("outputs/container_network_confinement_probe.json"),
    `${JSON.stringify(report, null, 2)}\n`
  );
  await writeFile(
    resolve("outputs/container_network_confinement_probe.md"),
    renderContainerNetworkConfinementMarkdown(report)
  );
} else {
  process.stdout.write(`${renderContainerNetworkConfinementMarkdown(report)}\n`);
}

if (report.status !== "passed") {
  process.exitCode = 1;
}
