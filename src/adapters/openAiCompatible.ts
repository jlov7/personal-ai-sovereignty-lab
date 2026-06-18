import type { ModelAdapter, ModelAdapterRequest, Turn } from "./types";
import { assertRemoteAdapterGate } from "./gate";

interface OpenAiChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    input_tokens?: number;
    output_tokens?: number;
  };
}

interface OllamaChatResponse {
  message?: { content?: string };
  prompt_eval_count?: number;
  eval_count?: number;
}

export type OpenAiCompatibleApi = "auto" | "ollama" | "openai";

export interface OpenAiCompatibleConfig {
  baseUrl: string;
  model: string;
  timeoutMs: number;
  api: OpenAiCompatibleApi;
  numCtx: number;
  numPredict: number;
  think: boolean;
  retries: number;
  apiKey?: string;
}

export class ModelInfrastructureError extends Error {
  constructor(
    message: string,
    readonly model: string
  ) {
    super(message);
    this.name = "ModelInfrastructureError";
  }
}

function toPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function openAiCompatibleConfigsFromEnv(env: NodeJS.ProcessEnv): OpenAiCompatibleConfig[] {
  const baseUrl = env.PAISL_MODEL_BASE_URL;
  const models = (env.PAISL_MODEL_NAMES ?? env.PAISL_MODEL_NAME ?? "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);

  if (!baseUrl || models.length === 0) {
    return [];
  }

  const apiSetting = (env.PAISL_MODEL_API ?? "auto").trim().toLowerCase();
  const api: OpenAiCompatibleApi =
    apiSetting === "ollama" || apiSetting === "openai" ? apiSetting : "auto";

  return models.map((model) => ({
    baseUrl,
    model,
    timeoutMs: toPositiveInt(env.PAISL_MODEL_TIMEOUT_MS, 180_000),
    api,
    numCtx: toPositiveInt(env.PAISL_MODEL_NUM_CTX, 16_384),
    numPredict: toPositiveInt(env.PAISL_MODEL_NUM_PREDICT, 2_048),
    think: (env.PAISL_MODEL_THINK ?? "false").trim().toLowerCase() === "true",
    retries: toPositiveInt(env.PAISL_MODEL_RETRIES, 3),
    apiKey: env.PAISL_MODEL_API_KEY
  }));
}

function isLocalUrl(baseUrl: string): boolean {
  try {
    const url = new URL(baseUrl);
    return ["127.0.0.1", "localhost", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function resolveApi(config: OpenAiCompatibleConfig): "ollama" | "openai" {
  if (config.api !== "auto") {
    return config.api;
  }
  return config.baseUrl.includes(":11434") ? "ollama" : "openai";
}

function ollamaRoot(baseUrl: string): string {
  return baseUrl.replace(/\/$/, "").replace(/\/v1$/, "");
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function contentMessages(messages: readonly Turn[]): Array<{ role: string; content: string }> {
  return messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "tool" ? "user" : message.role,
      content: message.role === "tool" ? `Tool result:\n${message.content}` : message.content
    }));
}

async function postJson(
  url: string,
  body: unknown,
  timeoutMs: number,
  apiKey: string | undefined
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (apiKey) {
    headers.authorization = `Bearer ${apiKey}`;
  }

  try {
    return await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

function requestBody(config: OpenAiCompatibleConfig, request: ModelAdapterRequest): unknown {
  const api = resolveApi(config);
  const messages = [
    { role: "system", content: request.system },
    ...contentMessages(request.messages)
  ];

  if (api === "ollama") {
    return {
      model: config.model,
      stream: false,
      think: config.think,
      options: {
        temperature: 0,
        num_ctx: config.numCtx,
        num_predict: Math.min(request.maxTokens, config.numPredict)
      },
      messages
    };
  }

  return {
    model: config.model,
    temperature: 0,
    max_tokens: Math.min(request.maxTokens, config.numPredict),
    messages
  };
}

function endpointUrl(config: OpenAiCompatibleConfig): string {
  return resolveApi(config) === "ollama"
    ? `${ollamaRoot(config.baseUrl)}/api/chat`
    : `${config.baseUrl.replace(/\/$/, "")}/chat/completions`;
}

function responseText(
  config: OpenAiCompatibleConfig,
  payload: OpenAiChatResponse & OllamaChatResponse
): string | null {
  return resolveApi(config) === "ollama"
    ? payload.message?.content ?? null
    : payload.choices?.[0]?.message?.content ?? null;
}

function responseUsage(
  payload: OpenAiChatResponse & OllamaChatResponse
): { inputTokens: number; outputTokens: number } | undefined {
  const inputTokens = payload.prompt_eval_count ?? payload.usage?.prompt_tokens ?? payload.usage?.input_tokens;
  const outputTokens = payload.eval_count ?? payload.usage?.completion_tokens ?? payload.usage?.output_tokens;
  return typeof inputTokens === "number" && typeof outputTokens === "number"
    ? { inputTokens, outputTokens }
    : undefined;
}

export function openAiCompatibleAdapter(
  config: OpenAiCompatibleConfig,
  options: { env?: NodeJS.ProcessEnv; argv?: readonly string[] } = {}
): ModelAdapter {
  const evidenceClass = isLocalUrl(config.baseUrl) ? "local_model" : "remote_model";
  if (evidenceClass === "remote_model") {
    assertRemoteAdapterGate({
      env: options.env ?? process.env,
      argv: options.argv ?? process.argv,
      credentialEnvVar: "PAISL_MODEL_API_KEY",
      provider: "openai-compatible",
      modelId: config.model,
      scenarioCount: 1,
      expectedTurnsPerScenario: 1,
      estimatedTokensPerTurn: config.numPredict
    });
  }

  return {
    id: `openai-compatible:${config.model}`,
    evidenceClass,
    async generate(request: ModelAdapterRequest): Promise<{ text: string; usage?: { inputTokens: number; outputTokens: number } }> {
      const url = endpointUrl(config);
      const body = requestBody(config, request);
      let lastError = "";

      for (let attempt = 0; attempt <= config.retries; attempt += 1) {
        try {
          const response = await postJson(url, body, config.timeoutMs, config.apiKey);
          if (response.status >= 500) {
            lastError = `endpoint returned ${response.status}`;
            if (attempt < config.retries) {
              await sleep(500 * (attempt + 1));
            }
            continue;
          }
          if (!response.ok) {
            throw new ModelInfrastructureError(
              `Model endpoint returned ${response.status}.`,
              config.model
            );
          }

          const payload = (await response.json()) as OpenAiChatResponse & OllamaChatResponse;
          const text = responseText(config, payload);
          if (text && text.trim().length > 0) {
            return { text, usage: responseUsage(payload) };
          }
          lastError = "response did not include message content";
          if (attempt < config.retries) {
            await sleep(500 * (attempt + 1));
          }
        } catch (error) {
          if (error instanceof ModelInfrastructureError) {
            throw error;
          }
          lastError = error instanceof Error ? error.message : "unknown network error";
          if (attempt < config.retries) {
            await sleep(500 * (attempt + 1));
          }
        }
      }

      throw new ModelInfrastructureError(
        `Model '${config.model}' did not return usable content after ${config.retries + 1} attempts (${lastError}).`,
        config.model
      );
    }
  };
}
