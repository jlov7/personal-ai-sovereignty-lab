import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeSovereigntyFrontierArtifacts } from "./sovereigntyFrontierReport";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

writeSovereigntyFrontierArtifacts(root).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
