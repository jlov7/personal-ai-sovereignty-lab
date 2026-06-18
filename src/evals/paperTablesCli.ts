import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { scenarios } from "../scenarios/library";
import { renderFiguresAndTables, type PaperPackageInputs } from "./paperPackage";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

type GeneratedPaperInputs = Omit<PaperPackageInputs, "scenarios">;

async function main(): Promise<void> {
  const sampleLog = JSON.parse(
    await readFile(resolve(root, "outputs/sample_run_log.json"), "utf8")
  ) as Omit<GeneratedPaperInputs, "annotationPacketV2CaseCount"> & {
    annotationPacketV2: { cases: unknown[] };
  };
  const figuresAndTables = renderFiguresAndTables({
    scenarios,
    ...sampleLog,
    annotationPacketV2CaseCount: sampleLog.annotationPacketV2.cases.length
  });
  await writeFile(resolve(root, "outputs/figures_and_tables.md"), figuresAndTables);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
