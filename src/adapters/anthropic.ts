import { assertRemoteAdapterGate } from "./gate";
import type { ModelAdapter, ModelAdapterRequest, Turn } from "./types";

const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6";

type AnthropicMessage = { role: "user" | "assistant"; content: string };

interface AnthropicClient {
  messages: {
    create(request: {
      model: string;
      max_tokens: number;
      system: string;
      messages: AnthropicMessage[];
    }): Promise<{
      content?: Array<{ type?: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    }>;
  };
}

interface AnthropicConstructor {
  new (options: { apiKey: string }): AnthropicClient;
}

function anthropicMessages(messages: readonly Turn[]): AnthropicMessage[] {
  return messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.role === "tool" ? `Tool result:\n${message.content}` : message.content
    }));
}

async function loadAnthropicConstructor(): Promise<AnthropicConstructor> {
  const specifier: string = "@anthropic-ai/sdk";
  const module = (await import(specifier)) as { default?: AnthropicConstructor };
  if (!module.default) {
    throw new Error("@anthropic-ai/sdk did not expose a default client constructor.");
  }
  return module.default;
}

export function anthropicAdapter(
  options: {
    env?: NodeJS.ProcessEnv;
    argv?: readonly string[];
    scenarioCount: number;
    expectedTurnsPerScenario: number;
    estimatedTokensPerTurn: number;
  }
): ModelAdapter {
  const env = options.env ?? process.env;
  const argv = options.argv ?? process.argv;
  const modelId = env.PAISL_ANTHROPIC_MODEL ?? DEFAULT_ANTHROPIC_MODEL;
  const gate = assertRemoteAdapterGate({
    env,
    argv,
    credentialEnvVar: "ANTHROPIC_API_KEY",
    provider: "anthropic",
    modelId,
    scenarioCount: options.scenarioCount,
    expectedTurnsPerScenario: options.expectedTurnsPerScenario,
    estimatedTokensPerTurn: options.estimatedTokensPerTurn
  });

  return {
    id: `anthropic:${modelId}`,
    evidenceClass: "remote_model",
    async generate(request: ModelAdapterRequest): Promise<{ text: string; usage?: { inputTokens: number; outputTokens: number } }> {
      let Anthropic: AnthropicConstructor;
      try {
        Anthropic = await loadAnthropicConstructor();
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown SDK load error";
        throw new Error(
          `Anthropic adapter is gated but @anthropic-ai/sdk is not available (${message}). Install it outside the default path before using this remote adapter.`
        );
      }

      const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY ?? "" });
      const response = await client.messages.create({
        model: gate.modelId,
        max_tokens: request.maxTokens,
        system: request.system,
        messages: anthropicMessages(request.messages)
      });
      const text = (response.content ?? [])
        .filter((block) => block.type === "text" && typeof block.text === "string")
        .map((block) => block.text)
        .join("\n");

      return {
        text,
        usage:
          typeof response.usage?.input_tokens === "number" &&
          typeof response.usage.output_tokens === "number"
            ? {
                inputTokens: response.usage.input_tokens,
                outputTokens: response.usage.output_tokens
              }
            : undefined
      };
    }
  };
}
