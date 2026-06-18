import { runAgent } from "../agent/runAgent";
import { createConsentReceipt, evaluateEgressAttempt } from "../privacy/egressGuard";
import type {
  AgentAction,
  AgentRun,
  BoundaryDecision,
  ConsentState,
  DataFlowEvent,
  GovernanceDecision,
  LayerId,
  Scenario
} from "../shared/types";
import { estimatePrivacyBudgetUsed } from "../privacy/dataMinimization";
import { scenarios } from "../scenarios/library";
import { evaluateRun } from "./scorer";

export type BaselineId =
  | "sovereign_hybrid"
  | "brokered_tool_agent"
  | "centralized_cloud"
  | "local_only";

export interface BaselineComparisonRow {
  baselineId: BaselineId;
  scenarioId: string;
  totalScore: number;
  usefulness: number;
  privacyPreservation: number;
  autonomyAppropriateness: number;
  dataMinimization: number;
  userControlAlignment: number;
  failureSummary: string;
}

function boundaryForCentralized(itemId: string, scenario: Scenario): LayerId {
  if (scenario.externalInteraction) {
    return "federated";
  }

  const item = scenario.dataItems.find((candidate) => candidate.id === itemId);
  if (item?.allowedLayers.includes("personal_cloud")) {
    return "personal_cloud";
  }

  return "federated";
}

function centralizedCloudBaseline(scenario: Scenario): AgentRun {
  const governanceDecisions: GovernanceDecision[] = scenario.dataItems.map((item) => ({
    dataItemId: item.id,
    label: item.label,
    decision: "safe_aggregate",
    layer: boundaryForCentralized(item.id, scenario),
    releasedForm: "raw external payload",
    consentRequired: false,
    reason:
      "Centralized baseline optimizes convenience by sending source context to a cloud assistant without explicit data-boundary gating.",
    policyTags: [
      `sensitivity:${item.sensitivity}`,
      "baseline:centralized",
      "baseline:unconsented",
      "release:raw"
    ]
  }));
  const action: AgentAction = {
    id: "centralized-cloud-action",
    label: "Send full task context to centralized assistant",
    layer: scenario.externalInteraction ? "federated" : "personal_cloud",
    purpose: "Maximize task completion by using all available context in one cloud request.",
    usesDataItemIds: scenario.dataItems.map((item) => item.id),
    status: "completed",
    explanation:
      "This negative-control baseline is intentionally unsafe: it completes the task by collapsing data boundaries."
  };
  const dataFlow: DataFlowEvent[] = governanceDecisions.map((decision, index) => ({
    step: index + 1,
    actor: action.label,
    layer: action.layer,
    dataItemIds: [decision.dataItemId],
    decision: decision.decision,
    description: `${decision.label}: raw context sent without a consent gate.`,
    consentGate: false
  }));

  return {
    runId: `baseline_centralized_${scenario.id}`,
    timestamp: new Date("2026-05-22T00:00:00.000Z").toISOString(),
    scenario,
    model: {
      name: "negative-control-centralized-cloud-assistant",
      mode: "baseline",
      determinism: "Synthetic negative control; no external model call."
    },
    decision: "Complete the task by sending raw context to a centralized assistant.",
    answer:
      "This baseline is intentionally high-convenience and low-sovereignty: it assumes central cloud access to all task context.",
    actions: [action],
    governanceDecisions,
    dataFlow,
    permissionsRequested: [],
    riskNotes: [
      "Negative control: raw context crosses a boundary without consent.",
      "Negative control: convenience is prioritized over minimization and user control."
    ],
    latencyMs: 240,
    privacyBudgetUsed: estimatePrivacyBudgetUsed(governanceDecisions)
  };
}

function localOnlyBaseline(scenario: Scenario): AgentRun {
  const governanceDecisions: GovernanceDecision[] = scenario.dataItems.map((item) => ({
    dataItemId: item.id,
    label: item.label,
    decision: "local_only" as BoundaryDecision,
    layer: "local",
    releasedForm: "local memory reference only",
    consentRequired: false,
    reason:
      "Local-only baseline refuses all boundary crossing, including minimized or user-approved higher-layer use.",
    policyTags: [`sensitivity:${item.sensitivity}`, "baseline:local-only", "boundary:over-restricted"]
  }));
  const actions: AgentAction[] = [
    {
      id: "local-only-synthesis",
      label: "Draft local-only answer",
      layer: "local",
      purpose: "Produce a conservative draft without using private compute or external action.",
      usesDataItemIds: scenario.dataItems.map((item) => item.id),
      status: "completed",
      explanation: "The baseline preserves privacy but may underperform tasks that need consented action."
    }
  ];

  if (scenario.externalInteraction || scenario.architectureLayerFocus.includes("federated")) {
    actions.push({
      id: "refuse-boundary-crossing",
      label: "Refuse higher-layer or external step",
      layer: "local",
      purpose: "Avoid any data movement even when a minimized, consented payload would be useful.",
      usesDataItemIds: [],
      status: "blocked",
      explanation:
        "This negative-control baseline demonstrates that privacy without useful consented escalation is incomplete."
    });
  }

  const dataFlow: DataFlowEvent[] = governanceDecisions.map((decision, index) => ({
    step: index + 1,
    actor: "Draft local-only answer",
    layer: "local",
    dataItemIds: [decision.dataItemId],
    decision: decision.decision,
    description: `${decision.label}: held local regardless of possible minimized use.`,
    consentGate: false
  }));

  return {
    runId: `baseline_local_only_${scenario.id}`,
    timestamp: new Date("2026-05-22T00:00:00.000Z").toISOString(),
    scenario,
    model: {
      name: "negative-control-local-only-agent",
      mode: "baseline",
      determinism: "Synthetic negative control; no external model call."
    },
    decision: "Keep every data item local and refuse escalation.",
    answer:
      "This baseline is intentionally over-restrictive: it preserves local boundaries but cannot exercise consented personal-cloud or federated usefulness.",
    actions,
    governanceDecisions,
    dataFlow,
    permissionsRequested: [],
    riskNotes: [
      "Negative control: useful consented escalation is unavailable.",
      "Negative control: privacy is preserved by refusing potentially valuable action."
    ],
    latencyMs: 190,
    privacyBudgetUsed: 0
  };
}

function brokeredToolAgentBaseline(scenario: Scenario): AgentRun {
  const consentState = Object.fromEntries(
    scenario.dataItems
      .filter((item) => item.defaultBoundary === "requires_consent")
      .map((item) => [item.id, true])
  );
  const run = runAgent(scenario, consentState);
  const toolEligible = scenario.dataItems.filter((item) => item.defaultBoundary === "requires_consent");
  const egressDecisions = toolEligible.map((item) => {
    const targetLayer = item.allowedLayers.find((layer) => layer !== "local") ?? "personal_cloud";
    const receipt = createConsentReceipt(
      scenario,
      item.id,
      targetLayer,
      "minimized_payload",
      "Brokered tool call with minimum necessary payload."
    );

    return evaluateEgressAttempt(scenario, {
      scenarioId: scenario.id,
      dataItemId: item.id,
      targetLayer,
      releaseForm: "minimized_payload",
      purpose: "Brokered tool call with minimum necessary payload.",
      attemptedAt: "2026-05-22T00:00:00.000Z",
      consentReceipt: receipt
    });
  });
  const brokerActions: AgentAction[] = egressDecisions.map((decision, index) => ({
    id: `brokered-tool-egress-${index + 1}`,
    label: decision.allowed ? "Execute brokered tool call" : "Block brokered tool call",
    layer: decision.attempt.targetLayer,
    purpose: decision.attempt.purpose,
    usesDataItemIds: [decision.attempt.dataItemId],
    status: decision.allowed ? "completed" : "blocked",
    explanation: `${decision.reason} Controls: ${decision.controls.join(", ")}.`
  }));

  return {
    ...run,
    runId: `baseline_brokered_tool_agent_${scenario.id}`,
    model: {
      name: "brokered-tool-agent-with-egress-guard",
      mode: "baseline",
      determinism: "Synthetic tool-agent baseline; egress attempts pass through consent receipts and an executable guard."
    },
    decision:
      brokerActions.length > 0
        ? "Use a brokered tool path only for consented minimized payloads."
        : "Use local reasoning; no brokered tool call is required.",
    answer:
      "This baseline simulates a tool-using personal agent whose non-local actions are mediated by consent receipts, minimization, retention deadlines, and an egress guard.",
    actions: [...run.actions, ...brokerActions],
    riskNotes: [
      ...run.riskNotes,
      ...egressDecisions.map((decision) => `Egress guard: ${decision.reason}`)
    ],
    privacyBudgetUsed:
      run.privacyBudgetUsed + egressDecisions.filter((decision) => decision.allowed).length
  };
}

export function runBaseline(
  scenario: Scenario,
  baselineId: BaselineId,
  consentState: ConsentState = {}
): AgentRun {
  if (baselineId === "sovereign_hybrid") {
    return runAgent(scenario, consentState);
  }
  if (baselineId === "brokered_tool_agent") {
    return brokeredToolAgentBaseline(scenario);
  }
  if (baselineId === "centralized_cloud") {
    return centralizedCloudBaseline(scenario);
  }
  return localOnlyBaseline(scenario);
}

export function compareBaselines(): BaselineComparisonRow[] {
  const baselineIds: BaselineId[] = [
    "sovereign_hybrid",
    "brokered_tool_agent",
    "centralized_cloud",
    "local_only"
  ];

  return scenarios.flatMap((scenario) =>
    baselineIds.map((baselineId) => {
      const result = evaluateRun(runBaseline(scenario, baselineId));
      const byId = new Map(result.metrics.map((metric) => [metric.id, metric.score]));

      return {
        baselineId,
        scenarioId: scenario.id,
        totalScore: result.totalScore,
        usefulness: byId.get("usefulness") ?? 0,
        privacyPreservation: byId.get("privacy_preservation") ?? 0,
        autonomyAppropriateness: byId.get("autonomy_appropriateness") ?? 0,
        dataMinimization: byId.get("data_minimization") ?? 0,
        userControlAlignment: byId.get("user_control_alignment") ?? 0,
        failureSummary: result.failureCases.slice(0, 2).join("; ")
      };
    })
  );
}
