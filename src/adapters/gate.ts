export interface RemoteAdapterGateInput {
  env: NodeJS.ProcessEnv;
  argv: readonly string[];
  credentialEnvVar: string;
  provider: string;
  modelId: string;
  scenarioCount: number;
  expectedTurnsPerScenario: number;
  estimatedTokensPerTurn: number;
}

export interface RemoteAdapterGateResult {
  provider: string;
  modelId: string;
  remoteEvalEnabled: boolean;
  credentialPresent: boolean;
  spendingFlagPresent: boolean;
  maxRuns: number | null;
  yesFlagPresent: boolean;
  estimatedTokens: number;
  tripleGateSatisfied: boolean;
  allowed: boolean;
  requiresInteractiveConfirmation: boolean;
  reasons: string[];
  preflightSummary: string;
}

function flagValue(argv: readonly string[], flag: string): string | null {
  const index = argv.indexOf(flag);
  if (index === -1) {
    return null;
  }
  return argv[index + 1] ?? null;
}

function positiveInt(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function evaluateRemoteAdapterGate(input: RemoteAdapterGateInput): RemoteAdapterGateResult {
  const remoteEvalEnabled = input.env.PAISL_REMOTE_EVAL === "1";
  const credentialPresent = Boolean(input.env[input.credentialEnvVar]);
  const spendingFlagPresent = input.argv.includes("--i-am-spending-money");
  const yesFlagPresent = input.argv.includes("--yes");
  const maxRuns = positiveInt(flagValue(input.argv, "--max-runs"));
  const tripleGateSatisfied = remoteEvalEnabled && credentialPresent && spendingFlagPresent;
  const estimatedTokens =
    input.scenarioCount * input.expectedTurnsPerScenario * input.estimatedTokensPerTurn;
  const reasons: string[] = [];

  if (!remoteEvalEnabled) {
    reasons.push("PAISL_REMOTE_EVAL=1 is required.");
  }
  if (!credentialPresent) {
    reasons.push(`${input.credentialEnvVar} is required.`);
  }
  if (!spendingFlagPresent) {
    reasons.push("The literal --i-am-spending-money flag is required.");
  }
  if (!maxRuns) {
    reasons.push("--max-runs <n> is required for remote adapters.");
  }

  const requiresInteractiveConfirmation = tripleGateSatisfied && Boolean(maxRuns) && !yesFlagPresent;
  if (requiresInteractiveConfirmation) {
    reasons.push("Interactive confirmation is required unless --yes is present.");
  }

  const allowed = tripleGateSatisfied && Boolean(maxRuns) && !requiresInteractiveConfirmation;
  return {
    provider: input.provider,
    modelId: input.modelId,
    remoteEvalEnabled,
    credentialPresent,
    spendingFlagPresent,
    maxRuns,
    yesFlagPresent,
    estimatedTokens,
    tripleGateSatisfied,
    allowed,
    requiresInteractiveConfirmation,
    reasons,
    preflightSummary: [
      `provider=${input.provider}`,
      `model=${input.modelId}`,
      `scenarios=${input.scenarioCount}`,
      `expectedTurns=${input.expectedTurnsPerScenario}`,
      `estimatedTokens=${estimatedTokens}`,
      `maxRuns=${maxRuns ?? "missing"}`
    ].join(" ")
  };
}

export function assertRemoteAdapterGate(input: RemoteAdapterGateInput): RemoteAdapterGateResult {
  const result = evaluateRemoteAdapterGate(input);
  if (!result.allowed) {
    throw new Error(`Remote adapter gate blocked: ${result.reasons.join(" ")}`);
  }
  return result;
}
