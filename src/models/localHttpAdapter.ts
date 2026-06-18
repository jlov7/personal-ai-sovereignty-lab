import {
  ModelInfrastructureError,
  openAiCompatibleAdapter,
  openAiCompatibleConfigsFromEnv,
  type OpenAiCompatibleApi,
  type OpenAiCompatibleConfig
} from "../adapters/openAiCompatible";
import { buildPlanPrompt, createModelPlan, type ModelPlan } from "./transcriptPlans";
import type { Scenario } from "../shared/types";

export type LocalModelApi = OpenAiCompatibleApi;
export type LocalHttpModelConfig = OpenAiCompatibleConfig;
export { ModelInfrastructureError };

export function localHttpConfigFromEnv(env: NodeJS.ProcessEnv): LocalHttpModelConfig | null {
  return localHttpConfigsFromEnv(env)[0] ?? null;
}

export function localHttpConfigsFromEnv(env: NodeJS.ProcessEnv): LocalHttpModelConfig[] {
  return openAiCompatibleConfigsFromEnv(env);
}

export async function runLocalHttpModelPlan(
  scenario: Scenario,
  config: LocalHttpModelConfig
): Promise<ModelPlan> {
  return runLocalHttpModelPrompt(
    scenario,
    config,
    buildPlanPrompt(scenario),
    "You produce auditable JSON plans for personal AI sovereignty benchmark scenarios."
  );
}

export async function runLocalHttpModelPrompt(
  scenario: Scenario,
  config: LocalHttpModelConfig,
  prompt: string,
  systemPrompt: string
): Promise<ModelPlan> {
  const adapter = openAiCompatibleAdapter(config);
  const response = await adapter.generate({
    system: systemPrompt,
    messages: [{ role: "user", content: prompt }],
    maxTokens: config.numPredict
  });
  return createModelPlan(scenario, config.model, response.text);
}
