import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeInterRaterReportV2 } from "./interRaterReportV2";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const seed = Number.parseInt(process.env.PAISL_ANNOTATION_SAMPLE_SEED ?? "20260611", 10);

writeInterRaterReportV2(root, seed).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
