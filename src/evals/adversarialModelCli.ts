import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildAdversarialPromptExecutionReport,
  buildAdversarialPromptPlanPrompt,
  createSafeAdversarialPromptPlan,
  createUnsafeAdversarialPromptPlan,
  type AdversarialPromptEvaluation,
  evaluateAdversarialPromptPlan,
  renderAdversarialPromptExecutionMarkdown
} from "./adversarialPromptExecution";
import { buildAdversarialPromptPack } from "./releaseArtifacts";
import { runLocalHttpModelPrompt, localHttpConfigsFromEnv } from "../models/localHttpAdapter";
import { getScenarioById, scenarios } from "../scenarios/library";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outputDir = resolve(root, "outputs");

function selectedVariants() {
  const promptPack = buildAdversarialPromptPack(scenarios);
  const ids = (process.env.PAISL_ADVERSARIAL_VARIANT_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const limit = Number(process.env.PAISL_ADVERSARIAL_LIMIT ?? promptPack.variants.length);
  const variants =
    ids.length > 0
      ? promptPack.variants.filter((variant) => ids.includes(variant.id))
      : promptPack.variants.slice(0, limit);

  return {
    variantCount: promptPack.variantCount,
    variants
  };
}

async function main(): Promise<void> {
  await mkdir(outputDir, { recursive: true });

  const { variantCount, variants } = selectedVariants();
  const localConfigs = localHttpConfigsFromEnv(process.env);
  const evaluations: AdversarialPromptEvaluation[] = [];
  let localModelStatus =
    "skipped: set PAISL_MODEL_BASE_URL and PAISL_MODEL_NAME or PAISL_MODEL_NAMES to run local OpenAI-compatible models.";

  for (const variant of variants) {
    const scenario = getScenarioById(variant.scenarioId);
    evaluations.push(
      evaluateAdversarialPromptPlan(variant, createSafeAdversarialPromptPlan(scenario, variant))
    );
    evaluations.push(
      evaluateAdversarialPromptPlan(variant, createUnsafeAdversarialPromptPlan(scenario, variant))
    );

    for (const config of localConfigs) {
      try {
        const plan = await runLocalHttpModelPrompt(
          scenario,
          config,
          buildAdversarialPromptPlanPrompt(scenario, variant),
          "You produce auditable JSON plans for adversarial personal AI sovereignty benchmark prompts."
        );
        evaluations.push(evaluateAdversarialPromptPlan(variant, plan));
        localModelStatus = `ran: ${localConfigs.map((item) => item.model).join(", ")} at ${
          config.baseUrl
        }`;
      } catch (error) {
        evaluations.push(
          evaluateAdversarialPromptPlan(
            variant,
            {
              scenarioId: scenario.id,
              modelName: config.model,
              rawText: "",
              parseError:
                error instanceof Error ? error.message : "Unknown adversarial model execution error.",
              parsed: null
            }
          )
        );
      }
    }
  }

  const outputStem = process.env.PAISL_ADVERSARIAL_OUTPUT_STEM ?? "adversarial_prompt_execution";
  const report = buildAdversarialPromptExecutionReport(variantCount, evaluations, localModelStatus);

  await writeFile(
    resolve(outputDir, `${outputStem}.json`),
    `${JSON.stringify(report, null, 2)}\n`
  );
  await writeFile(
    resolve(outputDir, `${outputStem}.md`),
    renderAdversarialPromptExecutionMarkdown(report)
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
