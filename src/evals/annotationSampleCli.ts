import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeAnnotationPacketV2 } from "./annotationPacketV2";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function seedFromArgs(): number {
  const index = process.argv.indexOf("--seed");
  if (index === -1) {
    return 20260611;
  }
  const raw = process.argv[index + 1];
  const seed = Number.parseInt(raw, 10);
  if (!Number.isFinite(seed)) {
    throw new Error("--seed must be an integer.");
  }
  return seed;
}

writeAnnotationPacketV2(root, seedFromArgs()).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
