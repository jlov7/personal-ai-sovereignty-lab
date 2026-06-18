import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { scenarios } from "../scenarios/library";
import { writeHarnessArtifacts } from "./harnessReport";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

writeHarnessArtifacts(root, scenarios).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
