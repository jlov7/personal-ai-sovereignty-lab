import type { ConsentState, LayerId, Scenario } from "../core/types";

export type HarnessToolName =
  | "read_local"
  | "search_local"
  | "summarize_local"
  | "request_consent"
  | "send_external"
  | "post_private_compute"
  | "publish_aggregate"
  | "fetch_reference"
  | "finish";

export interface CanaryRecord {
  scenarioId: string;
  dataItemId: string;
  token: string;
  core: string;
}

export interface HarnessToolCall {
  tool: HarnessToolName;
  args: Record<string, unknown>;
}

export interface HarnessModelRequest {
  scenario: Scenario;
  turn: number;
  messages: HarnessMessage[];
  canaries: CanaryRecord[];
  consentState: ConsentState;
}

export interface HarnessModelAdapter {
  readonly id: string;
  next(request: HarnessModelRequest): Promise<string>;
}

export interface HarnessMessage {
  role: "system" | "user" | "tool";
  content: string;
}

export interface HarnessToolResult {
  tool: HarnessToolName;
  ok: boolean;
  content: string;
  finished?: boolean;
}

export type LeakTransform =
  | "identity"
  | "lowercase"
  | "stripped"
  | "base64_decoded"
  | "hex_decoded"
  | "url_decoded"
  | "base64_core"
  | "hex_core";

export interface LeakMatch {
  dataItemId: string;
  transform: LeakTransform;
  offset: number;
}

export interface ConfirmedLeakFinding extends LeakMatch {
  scenarioId: string;
  tool: HarnessToolName;
  layer: Exclude<LayerId, "local">;
  turn: number;
  payloadExcerpt: string;
  disallowed: boolean;
  reason: string;
}

export interface HarnessConsentEvent {
  turn: number;
  dataItemIds: string[];
  purpose: string;
  releaseForm: string;
  granted: boolean;
  unnecessary: boolean;
}

export interface HarnessEgressRecord {
  turn: number;
  tool: HarnessToolName;
  layer: Exclude<LayerId, "local">;
  payload: string;
  dataItemIds: string[];
  consentStateSnapshot: ConsentState;
  leakMatches: LeakMatch[];
  confirmedLeaks: ConfirmedLeakFinding[];
}

export interface HarnessTurnRecord {
  turn: number;
  modelText: string;
  parseError: string | null;
  toolCalls: HarnessToolCall[];
  toolResults: HarnessToolResult[];
}

export type HarnessRunStatus = "completed" | "limit_exceeded" | "format_failure";

export interface HarnessRunScore {
  slr: 0 | 1;
  usefulness: number;
  successChecksSatisfied: number;
  successChecksTotal: number;
  consentCorrectness: number;
  releasedWithoutGrant: number;
  overAskCount: number;
}

export interface HarnessRunRecord {
  benchmark: "personal-ai-sovereignty-harness";
  version: "0.20.0";
  generatedAt: string;
  runId: string;
  agentId: string;
  scenarioId: string;
  status: HarnessRunStatus;
  turns: HarnessTurnRecord[];
  consentEvents: HarnessConsentEvent[];
  egressRecords: HarnessEgressRecord[];
  leakFindings: ConfirmedLeakFinding[];
  finalAnswer: string;
  score: HarnessRunScore;
  limits: {
    maxTurns: number;
    maxToolCallsPerTurn: number;
    maxTotalToolCalls: number;
    adapterTimeoutMs: number;
    wallClockTimeoutMs: number;
  };
}
