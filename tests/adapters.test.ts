import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { anthropicAdapter } from "../src/adapters/anthropic";
import { deterministicPolicyAdapter } from "../src/adapters/deterministicPolicy";
import { evaluateRemoteAdapterGate } from "../src/adapters/gate";
import {
  openAiCompatibleAdapter,
  openAiCompatibleConfigsFromEnv
} from "../src/adapters/openAiCompatible";
import { extractJsonObject } from "../src/models/transcriptPlans";
import { getScenarioById } from "../src/scenarios/library";

describe("model adapters", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("locks all eight combinations of the remote triple gate", () => {
    for (const remoteEvalEnabled of [false, true]) {
      for (const credentialPresent of [false, true]) {
        for (const spendingFlagPresent of [false, true]) {
          const result = evaluateRemoteAdapterGate({
            env: {
              PAISL_REMOTE_EVAL: remoteEvalEnabled ? "1" : undefined,
              TEST_KEY: credentialPresent ? "present" : undefined
            },
            argv: [
              ...(spendingFlagPresent ? ["--i-am-spending-money"] : []),
              "--max-runs",
              "1",
              "--yes"
            ],
            credentialEnvVar: "TEST_KEY",
            provider: "test",
            modelId: "test-model",
            scenarioCount: 1,
            expectedTurnsPerScenario: 2,
            estimatedTokensPerTurn: 100
          });

          expect(result.tripleGateSatisfied).toBe(
            remoteEvalEnabled && credentialPresent && spendingFlagPresent
          );
          expect(result.allowed).toBe(result.tripleGateSatisfied);
        }
      }
    }
  });

  it("requires max-runs and confirmation after the triple gate passes", () => {
    const base = {
      env: { PAISL_REMOTE_EVAL: "1", TEST_KEY: "present" },
      credentialEnvVar: "TEST_KEY",
      provider: "test",
      modelId: "test-model",
      scenarioCount: 2,
      expectedTurnsPerScenario: 3,
      estimatedTokensPerTurn: 100
    };

    expect(evaluateRemoteAdapterGate({ ...base, argv: ["--i-am-spending-money"] }).allowed).toBe(false);
    const confirmation = evaluateRemoteAdapterGate({
      ...base,
      argv: ["--i-am-spending-money", "--max-runs", "2"]
    });
    expect(confirmation.requiresInteractiveConfirmation).toBe(true);
    expect(
      evaluateRemoteAdapterGate({
        ...base,
        argv: ["--i-am-spending-money", "--max-runs", "2", "--yes"]
      }).allowed
    ).toBe(true);
  });

  it("keeps hermetic eval from importing remote adapters", () => {
    const cliSource = readFileSync(resolve(__dirname, "../src/evals/cli.ts"), "utf8");

    expect(cliSource).not.toContain("../adapters/anthropic");
    expect(cliSource).not.toContain("../adapters/gate");
  });

  it("generates a deterministic oracle plan through the adapter contract", async () => {
    const scenario = getScenarioById("subscription-negotiation");
    const adapter = deterministicPolicyAdapter(scenario);
    const response = await adapter.generate({ system: "", messages: [], maxTokens: 1000 });
    const parsed = extractJsonObject(response.text) as { proposedActions?: unknown };

    expect(adapter.evidenceClass).toBe("deterministic");
    expect(Array.isArray(parsed.proposedActions)).toBe(true);
  });

  it("builds local OpenAI-compatible configs from env without remote gating", async () => {
    const configs = openAiCompatibleConfigsFromEnv({
      PAISL_MODEL_BASE_URL: "http://127.0.0.1:11434/v1",
      PAISL_MODEL_NAMES: "gemma4:26b",
      PAISL_MODEL_NUM_CTX: "8192",
      PAISL_MODEL_NUM_PREDICT: "512"
    });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ message: { content: "{\"ok\":true}" }, prompt_eval_count: 3, eval_count: 4 })
    }));
    vi.stubGlobal("fetch", fetchMock);

    const adapter = openAiCompatibleAdapter(configs[0], { env: {}, argv: [] });
    const response = await adapter.generate({
      system: "system",
      messages: [{ role: "user", content: "hello" }],
      maxTokens: 100
    });

    expect(adapter.evidenceClass).toBe("local_model");
    expect(response.text).toBe("{\"ok\":true}");
    expect(response.usage).toEqual({ inputTokens: 3, outputTokens: 4 });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:11434/api/chat",
      expect.objectContaining({
        body: expect.stringContaining("\"num_ctx\":8192")
      })
    );
  });

  it("blocks Anthropic construction unless the remote gate is satisfied", () => {
    expect(() =>
      anthropicAdapter({
        env: {},
        argv: [],
        scenarioCount: 1,
        expectedTurnsPerScenario: 1,
        estimatedTokensPerTurn: 1000
      })
    ).toThrow(/Remote adapter gate blocked/);
  });
});
