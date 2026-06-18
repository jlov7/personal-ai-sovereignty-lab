import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyArtifactManifest, writeArtifactManifest } from "./artifactManifest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const mode = process.argv[2] ?? "write";

async function main(): Promise<void> {
  if (mode === "verify") {
    const failures = await verifyArtifactManifest(root);
    if (failures.length > 0) {
      console.error(`Artifact manifest verification failed:\n${failures.join("\n")}`);
      process.exitCode = 1;
    }
    return;
  }

  await writeArtifactManifest(root);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
