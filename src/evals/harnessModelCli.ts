import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { harnessAdapterFromModelAdapter } from "../adapters/harness";
import { openAiCompatibleAdapter, openAiCompatibleConfigsFromEnv } from "../adapters/openAiCompatible";
import { runHarnessScenario } from "../harness/engine";
import type { HarnessRunRecord } from "../harness/types";
import { getScenarioById, scenarios } from "../scenarios/library";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const shouldWrite = process.argv.includes("--write");

function selectedScenarios() {
  const scenarioIds = (process.env.PAISL_HARNESS_SCENARIO_IDS ?? process.env.PAISL_HARNESS_SCENARIO_ID ?? "data-rights-request")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return scenarioIds.length === 1 && scenarioIds[0] === "all"
    ? scenarios
    : scenarioIds.map((id) => getScenarioById(id));
}

function fileSafe(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function summarize(runs: HarnessRunRecord[]): string {
  const leakRuns = runs.filter((run) => run.score.slr === 1).length;
  const usefulness =
    runs.reduce((sum, run) => sum + run.score.usefulness, 0) / Math.max(1, runs.length);
  return [
    `runs=${runs.length}`,
    `leakRuns=${leakRuns}`,
    `slr=${(leakRuns / Math.max(1, runs.length)).toFixed(4)}`,
    `usefulness=${usefulness.toFixed(4)}`
  ].join(" ");
}

async function main(): Promise<void> {
  const configs = openAiCompatibleConfigsFromEnv(process.env);
  if (configs.length === 0) {
    console.log(
      "skipped: set PAISL_MODEL_BASE_URL and PAISL_MODEL_NAMES to run harness model evidence; no files written."
    );
    return;
  }

  const selected = selectedScenarios();
  const runs: HarnessRunRecord[] = [];
  for (const config of configs) {
    const adapter = harnessAdapterFromModelAdapter(openAiCompatibleAdapter(config));
    for (const scenario of selected) {
      runs.push(await runHarnessScenario(scenario, adapter));
    }
  }

  if (shouldWrite) {
    const outputDir = resolve(root, "outputs/harness_model_runs");
    await mkdir(outputDir, { recursive: true });
    await Promise.all(
      runs.map((run) =>
        writeFile(
          resolve(outputDir, `${fileSafe(run.agentId)}__${run.scenarioId}.jsonl`),
          `${JSON.stringify(run)}\n`
        )
      )
    );
  }

  console.log(
    `${shouldWrite ? "wrote" : "ran"} harness model evidence: ${summarize(runs)}`
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
