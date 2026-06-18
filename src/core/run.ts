import { evaluateScenarioGovernance, permissionRequestsFromDecisions } from "./boundary";
import { estimatePrivacyBudgetUsed } from "./score";
import type {
  AgentAction,
  AgentRun,
  ConsentState,
  DataFlowEvent,
  GovernanceDecision,
  Scenario
} from "./types";

export function createDeterministicAnswer(
  scenario: Scenario,
  decisions: GovernanceDecision[]
): string {
  const localItems = decisions
    .filter((decision) => decision.decision === "local_only")
    .map((decision) => decision.label);
  const sharedItems = decisions
    .filter((decision) => decision.decision === "safe_aggregate")
    .map((decision) => decision.label);
  const blockedItems = decisions
    .filter((decision) => decision.decision === "blocked")
    .map((decision) => decision.label);
  const consentItems = decisions
    .filter((decision) => decision.decision === "requires_consent")
    .map((decision) => decision.label);

  return [
    `Recommended path for ${scenario.title}: ${scenario.expectedOutputs.join(", ")}.`,
    localItems.length > 0 ? `Keep local: ${localItems.join("; ")}.` : "No raw source data needs to leave the local layer.",
    sharedItems.length > 0 ? `Shareable only as minimized output: ${sharedItems.join("; ")}.` : "No data is currently shareable beyond the local layer.",
    consentItems.length > 0 ? `Ask before boundary crossing: ${consentItems.join("; ")}.` : "No pending consent gate remains.",
    blockedItems.length > 0 ? `Blocked from release: ${blockedItems.join("; ")}.` : "No data release was blocked.",
    `Failure modes to watch: ${scenario.failureModes.slice(0, 2).join("; ")}.`
  ].join(" ");
}

export function buildAgentActions(
  scenario: Scenario,
  decisions: GovernanceDecision[],
  consentState: ConsentState
): AgentAction[] {
  const localDataIds = decisions
    .filter((decision) => decision.decision === "local_only" || decision.decision === "blocked")
    .map((decision) => decision.dataItemId);
  const aggregateDataIds = decisions
    .filter((decision) => decision.decision === "safe_aggregate")
    .map((decision) => decision.dataItemId);
  const consentDataIds = decisions
    .filter((decision) => decision.decision === "requires_consent")
    .map((decision) => decision.dataItemId);
  const allConsentGranted = consentDataIds.every((id) => consentState[id]);

  const actions: AgentAction[] = [
    {
      id: "local-reasoning",
      label: "Interpret user objective locally",
      layer: "local",
      purpose: "Parse the task, identify sensitive fields, and choose the least-privilege plan.",
      usesDataItemIds: scenario.dataItems.map((item) => item.id),
      status: "completed",
      explanation: "All source data is first inspected under the on-device policy boundary."
    },
    {
      id: "local-synthesis",
      label: "Draft local answer and withheld-data list",
      layer: "local",
      purpose: "Produce a useful draft without crossing a data boundary.",
      usesDataItemIds: localDataIds,
      status: "completed",
      explanation: "The first answer is generated from local memory references and policy tags."
    }
  ];

  if (aggregateDataIds.length > 0 || consentDataIds.length > 0) {
    actions.push({
      id: "private-compute-polish",
      label: "Optional private-compute polishing",
      layer: "personal_cloud",
      purpose: "Use only minimized or approved payloads for formatting, ranking, or comparison.",
      usesDataItemIds: [...aggregateDataIds, ...consentDataIds],
      status: consentDataIds.length > 0 && !allConsentGranted ? "needs_user_approval" : "completed",
      explanation:
        consentDataIds.length > 0 && !allConsentGranted
          ? "The action is paused until the user grants explicit consent."
          : "Only aggregate or approved fields are available to the private-compute layer."
    });
  }

  if (scenario.externalInteraction) {
    actions.push({
      id: "external-negotiation",
      label: "Simulate consent-gated external negotiation",
      layer: "federated",
      purpose: "Send the minimum viable request to an outside business or collective layer.",
      usesDataItemIds: aggregateDataIds,
      status: aggregateDataIds.length > 0 ? "completed" : "needs_user_approval",
      explanation:
        "The external side receives only a sanitized payload and never sees local bargaining constraints."
    });
  }

  return actions;
}

export function buildDataFlow(
  decisions: GovernanceDecision[],
  actions: AgentAction[]
): DataFlowEvent[] {
  const events: DataFlowEvent[] = [];

  actions.forEach((action, actionIndex) => {
    const actionDecisions = decisions.filter((decision) =>
      action.usesDataItemIds.includes(decision.dataItemId)
    );

    if (actionDecisions.length === 0) {
      events.push({
        step: actionIndex + 1,
        actor: action.label,
        layer: action.layer,
        dataItemIds: [],
        decision: action.status === "blocked" ? "blocked" : "safe_aggregate",
        description: action.explanation,
        consentGate: action.status === "needs_user_approval"
      });
      return;
    }

    actionDecisions.forEach((decision) => {
      events.push({
        step: events.length + 1,
        actor: action.label,
        layer: action.layer,
        dataItemIds: [decision.dataItemId],
        decision: decision.decision,
        description: `${decision.label}: ${decision.reason}`,
        consentGate: decision.consentRequired
      });
    });
  });

  return events;
}

function stableRunId(scenario: Scenario, consentState: ConsentState): string {
  const granted = Object.entries(consentState)
    .filter(([, value]) => value)
    .map(([key]) => key)
    .sort()
    .join(".");
  return `run_${scenario.id}_${granted || "no-consent"}`;
}

function estimateLatencyMs(scenario: Scenario, actionCount: number): number {
  const dataCost = scenario.dataItems.reduce((sum, item) => sum + item.dataVolume, 0) * 9;
  const layerCost = scenario.architectureLayerFocus.length * 35;
  return 140 + dataCost + layerCost + actionCount * 18;
}

export function runAgent(scenario: Scenario, consentState: ConsentState = {}): AgentRun {
  const governanceDecisions = evaluateScenarioGovernance(scenario, consentState);
  const actions = buildAgentActions(scenario, governanceDecisions, consentState);
  const dataFlow = buildDataFlow(governanceDecisions, actions);
  const permissionsRequested = permissionRequestsFromDecisions(governanceDecisions);
  const blocked = governanceDecisions.filter((decision) => decision.decision === "blocked");
  const needsConsent = governanceDecisions.filter(
    (decision) => decision.decision === "requires_consent"
  );

  const decision =
    blocked.length > 0
      ? "Proceed with local-only reasoning and block unsafe release."
      : needsConsent.length > 0
        ? "Proceed locally, pause boundary crossing until consent."
        : "Proceed with minimized data flow.";

  const riskNotes = [
    ...scenario.riskTriggers.map((trigger) => `Risk trigger: ${trigger}.`),
    ...blocked.map((item) => `Blocked release: ${item.label}.`),
    ...needsConsent.map((item) => `Consent required before using ${item.label} in ${item.layer}.`)
  ];

  return {
    runId: stableRunId(scenario, consentState),
    timestamp: new Date("2026-05-22T00:00:00.000Z").toISOString(),
    scenario,
    model: {
      name: "deterministic-local-policy-simulator",
      mode: "mocked_local",
      determinism: "No external model call; output is derived from scenario fixtures and policy rules."
    },
    decision,
    answer: createDeterministicAnswer(scenario, governanceDecisions),
    actions,
    governanceDecisions,
    dataFlow,
    permissionsRequested,
    riskNotes,
    latencyMs: estimateLatencyMs(scenario, actions.length),
    privacyBudgetUsed: estimatePrivacyBudgetUsed(governanceDecisions)
  };
}
