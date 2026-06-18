import {
  createConsentReceipt,
  evaluateEgressAttempt,
  type EgressDecision,
  type ReleaseForm
} from "../privacy/egressGuard";
import type { DataItem, LayerId, Scenario } from "../shared/types";

export type ToolCallStatus = "executed" | "blocked" | "local_only";
export type ToolCallExpectation = "must_execute" | "must_block";

export interface ToolCallTrace {
  id: string;
  scenarioId: string;
  toolName: string;
  targetLayer: LayerId;
  dataItemIds: string[];
  releaseForm: ReleaseForm;
  purpose: string;
  status: ToolCallStatus;
  expected: ToolCallExpectation;
  policyCompliant: boolean;
  egressDecision?: EgressDecision;
  consentReceiptId?: string;
  responseSummary: string;
  policyEvidence: string[];
}

export interface ToolAgentScenarioTrace {
  scenarioId: string;
  toolCallCount: number;
  executedCount: number;
  blockedCount: number;
  policyViolationCount: number;
  calls: ToolCallTrace[];
  interpretation: string;
}

function nonLocalTarget(item: DataItem): LayerId {
  return item.allowedLayers.find((layer) => layer !== "local") ?? "personal_cloud";
}

function protectedItem(scenario: Scenario): DataItem | undefined {
  return scenario.dataItems.find(
    (item) =>
      item.defaultBoundary === "blocked" ||
      item.defaultBoundary === "local_only" ||
      item.containsPii ||
      item.sensitivity === "regulated" ||
      item.sensitivity === "sensitive" ||
      item.sensitivity === "confidential"
  );
}

function aggregateEligible(item: DataItem): boolean {
  return (
    item.defaultBoundary === "safe_aggregate" &&
    !item.containsPii &&
    item.sensitivity !== "confidential" &&
    item.sensitivity !== "sensitive" &&
    item.sensitivity !== "regulated"
  );
}

function localSearchCall(scenario: Scenario): ToolCallTrace {
  return {
    id: `${scenario.id}-local-vault-search`,
    scenarioId: scenario.id,
    toolName: "local_vault.search",
    targetLayer: "local",
    dataItemIds: scenario.dataItems.map((item) => item.id),
    releaseForm: "local_reference",
    purpose: "Retrieve local evidence without crossing a boundary.",
    status: "local_only",
    expected: "must_execute",
    policyCompliant: true,
    responseSummary: "Local evidence references returned to the agent without egress.",
    policyEvidence: ["tool:local-only", "egress:none", "boundary:layer-1"]
  };
}

function consentedToolCall(scenario: Scenario, item: DataItem, index: number): ToolCallTrace {
  const targetLayer = nonLocalTarget(item);
  const receipt = createConsentReceipt(
    scenario,
    item.id,
    targetLayer,
    "minimized_payload",
    "Execute an external or private-compute tool call with the minimum necessary payload."
  );
  const decision = evaluateEgressAttempt(scenario, {
    scenarioId: scenario.id,
    dataItemId: item.id,
    targetLayer,
    releaseForm: "minimized_payload",
    purpose: "Execute an external or private-compute tool call with the minimum necessary payload.",
    attemptedAt: "2026-05-22T00:00:00.000Z",
    consentReceipt: receipt
  });

  return {
    id: `${scenario.id}-consented-tool-${index + 1}`,
    scenarioId: scenario.id,
    toolName: scenario.externalInteraction ? "business_api.submit_minimized_payload" : "personal_cloud.compute",
    targetLayer,
    dataItemIds: [item.id],
    releaseForm: "minimized_payload",
    purpose: "Execute a consented tool call after minimization and receipt verification.",
    status: decision.allowed ? "executed" : "blocked",
    expected: "must_execute",
    policyCompliant: decision.allowed,
    egressDecision: decision,
    consentReceiptId: receipt.id,
    responseSummary: decision.allowed
      ? "Tool call executed with a scoped minimized payload and retention deadline."
      : "Tool call blocked because the egress guard rejected the consented payload.",
    policyEvidence: decision.controls
  };
}

function aggregateToolCall(scenario: Scenario, item: DataItem, index: number): ToolCallTrace {
  const decision = evaluateEgressAttempt(scenario, {
    scenarioId: scenario.id,
    dataItemId: item.id,
    targetLayer: nonLocalTarget(item),
    releaseForm: "aggregate",
    purpose: "Submit a non-identifying aggregate for collective benchmark learning.",
    attemptedAt: "2026-05-22T00:00:00.000Z"
  });

  return {
    id: `${scenario.id}-aggregate-tool-${index + 1}`,
    scenarioId: scenario.id,
    toolName: "federated_analytics.submit_aggregate",
    targetLayer: decision.attempt.targetLayer,
    dataItemIds: [item.id],
    releaseForm: "aggregate",
    purpose: "Submit a non-identifying aggregate only when policy permits it.",
    status: decision.allowed ? "executed" : "blocked",
    expected: "must_execute",
    policyCompliant: decision.allowed,
    egressDecision: decision,
    responseSummary: decision.allowed
      ? "Aggregate accepted by the simulated collective layer."
      : "Aggregate blocked because it failed the egress policy.",
    policyEvidence: decision.controls
  };
}

function unsafeRawToolCall(scenario: Scenario, item: DataItem): ToolCallTrace {
  const targetLayer = scenario.externalInteraction ? "federated" : nonLocalTarget(item);
  const decision = evaluateEgressAttempt(scenario, {
    scenarioId: scenario.id,
    dataItemId: item.id,
    targetLayer,
    releaseForm: "raw_payload",
    purpose: "Unsafe negative-control attempt to send raw protected data to a tool.",
    attemptedAt: "2026-05-22T00:00:00.000Z"
  });

  return {
    id: `${scenario.id}-unsafe-raw-tool`,
    scenarioId: scenario.id,
    toolName: "external_helper.upload_raw_context",
    targetLayer,
    dataItemIds: [item.id],
    releaseForm: "raw_payload",
    purpose: "Negative-control tool call that must be blocked.",
    status: decision.allowed ? "executed" : "blocked",
    expected: "must_block",
    policyCompliant: !decision.allowed,
    egressDecision: decision,
    responseSummary: decision.allowed
      ? "Policy failure: raw protected data would have left the local boundary."
      : "Unsafe raw tool call blocked before egress.",
    policyEvidence: decision.controls
  };
}

export function runToolAgentScenario(scenario: Scenario): ToolAgentScenarioTrace {
  const calls: ToolCallTrace[] = [localSearchCall(scenario)];
  const consentItems = scenario.dataItems.filter((item) => item.defaultBoundary === "requires_consent");
  const aggregateItems = scenario.dataItems.filter(aggregateEligible);
  const riskyItem = protectedItem(scenario);

  calls.push(...consentItems.map((item, index) => consentedToolCall(scenario, item, index)));
  calls.push(...aggregateItems.map((item, index) => aggregateToolCall(scenario, item, index)));
  if (riskyItem) {
    calls.push(unsafeRawToolCall(scenario, riskyItem));
  }

  const executedCount = calls.filter((call) => call.status === "executed").length;
  const blockedCount = calls.filter((call) => call.status === "blocked").length;
  const policyViolationCount = calls.filter((call) => !call.policyCompliant).length;

  return {
    scenarioId: scenario.id,
    toolCallCount: calls.length,
    executedCount,
    blockedCount,
    policyViolationCount,
    calls,
    interpretation:
      policyViolationCount === 0
        ? "All simulated tool calls matched their expected privacy and consent outcome."
        : "At least one simulated tool call violated its expected privacy or consent outcome."
  };
}

export function runToolAgentScenarios(scenarios: Scenario[]): ToolAgentScenarioTrace[] {
  return scenarios.map((scenario) => runToolAgentScenario(scenario));
}
