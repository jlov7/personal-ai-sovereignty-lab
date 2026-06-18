import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAttackScripts, type AttackScript, type AttackTier } from "../adversary/scripts";
import { harnessAdapterFromModelAdapter } from "../adapters/harness";
import { openAiCompatibleAdapter, openAiCompatibleConfigsFromEnv } from "../adapters/openAiCompatible";
import { runHarnessScenario } from "../harness/engine";
import { getScenarioById, scenarios } from "../scenarios/library";
import {
  buildDifficultyCalibrationReport,
  injectedMessagesForAttackScript,
  type DifficultyCalibrationRunSource,
  writeDifficultyCalibrationArtifacts
} from "./difficultyCalibrationReport";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const shouldWrite = process.argv.includes("--write");

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function positiveInt(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function csv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function selectedScripts(allScripts: AttackScript[]): AttackScript[] {
  const ids = new Set(csv(process.env.PAISL_DIFFICULTY_SCRIPT_IDS ?? argValue("--script-ids")));
  const tiers = new Set(
    csv(process.env.PAISL_DIFFICULTY_TIERS ?? argValue("--tiers")).filter((tier): tier is AttackTier =>
      ["T2", "T3", "T4"].includes(tier)
    )
  );
  const limit = positiveInt(argValue("--script-limit") ?? process.env.PAISL_DIFFICULTY_SCRIPT_LIMIT);

  const filtered = allScripts.filter(
    (script) =>
      (ids.size === 0 || ids.has(script.id)) &&
      (tiers.size === 0 || tiers.has(script.tier))
  );

  return limit ? filtered.slice(0, limit) : filtered;
}

function fileSafe(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

async function clearRunsDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  const files = await readdir(dir);
  await Promise.all(
    files
      .filter((file) => file.endsWith(".jsonl"))
      .sort()
      .map((file) => rm(resolve(dir, file)))
  );
}

async function main(): Promise<void> {
  const configs = openAiCompatibleConfigsFromEnv(process.env);
  if (configs.length === 0) {
    console.log(
      "skipped: set PAISL_MODEL_BASE_URL and PAISL_MODEL_NAMES to run live difficulty calibration; no files written."
    );
    return;
  }

  const scripts = selectedScripts(buildAttackScripts(scenarios));
  if (scripts.length === 0) {
    throw new Error("No difficulty calibration scripts selected.");
  }

  const runsDir = resolve(root, "outputs/difficulty_calibration_runs");
  if (shouldWrite) {
    await clearRunsDir(runsDir);
  }

  const sources: DifficultyCalibrationRunSource[] = [];
  for (const config of configs) {
    const adapter = harnessAdapterFromModelAdapter(openAiCompatibleAdapter(config));
    for (const [index, script] of scripts.entries()) {
      console.log(
        `running difficulty calibration ${index + 1}/${scripts.length} model=${adapter.id} script=${script.id}`
      );
      const scenario = getScenarioById(script.scenarioId);
      const run = await runHarnessScenario(scenario, adapter, {
        injectedMessages: injectedMessagesForAttackScript(script)
      });
      const record = {
        ...run,
        runId: `${run.runId}_${script.id}`
      };
      const sourcePath = `outputs/difficulty_calibration_runs/${fileSafe(adapter.id)}__${script.id}.jsonl`;
      sources.push({ script, record, sourcePath });

      if (shouldWrite) {
        await writeFile(
          resolve(root, sourcePath),
          `${JSON.stringify({ scriptId: script.id, run: record })}\n`
        );
      }
      console.log(
        `completed difficulty calibration ${index + 1}/${scripts.length} model=${adapter.id} script=${script.id} status=${record.status} slr=${record.score.slr} usefulness=${record.score.usefulness.toFixed(4)}`
      );
    }
  }

  const report = shouldWrite
    ? await writeDifficultyCalibrationArtifacts(root, sources)
    : buildDifficultyCalibrationReport(sources);
  const strongest = report.strongestConfiguredModel
    ? `${report.strongestConfiguredModel.modelId} passRate=${report.strongestConfiguredModel.passRate.toFixed(4)}`
    : "none";

  console.log(
    `${shouldWrite ? "wrote" : "ran"} difficulty calibration: runs=${report.rowCount} scripts=${report.scriptCount} models=${report.modelCount} strongest=${strongest} saturationGuard=${report.saturationGuard.passed ? "pass" : "fail"}`
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
