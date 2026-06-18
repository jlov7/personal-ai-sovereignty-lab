import type {
  BoundaryDecision,
  ConsentState,
  DataItem,
  GovernanceDecision,
  LayerId,
  PermissionRequest,
  Scenario
} from "./types";

const sensitiveLevels = new Set(["confidential", "sensitive", "regulated"]);

function highestPermittedLayer(item: DataItem, scenario: Scenario): LayerId {
  if (scenario.externalInteraction && item.allowedLayers.includes("federated")) {
    return "federated";
  }

  if (
    scenario.architectureLayerFocus.includes("personal_cloud") &&
    item.allowedLayers.includes("personal_cloud")
  ) {
    return "personal_cloud";
  }

  return "local";
}

function hasGrantedConsent(item: DataItem, consentState: ConsentState): boolean {
  return consentState[item.id] === true;
}

export function evaluateDataItem(
  item: DataItem,
  scenario: Scenario,
  consentState: ConsentState = {}
): GovernanceDecision {
  const tags: string[] = [`sensitivity:${item.sensitivity}`];
  const targetLayer = highestPermittedLayer(item, scenario);
  const granted = hasGrantedConsent(item, consentState);

  if (
    scenario.externalInteraction &&
    sensitiveLevels.has(item.sensitivity) &&
    (item.containsPii || item.defaultBoundary === "local_only" || !item.allowedLayers.includes("federated"))
  ) {
    return {
      dataItemId: item.id,
      label: item.label,
      decision: "blocked",
      layer: "local",
      releasedForm: "none",
      consentRequired: false,
      reason:
        "Raw sensitive or confidential data with personal context cannot be released into an external interaction.",
      policyTags: [...tags, "external-release:block"]
    };
  }

  if (item.defaultBoundary === "blocked") {
    return {
      dataItemId: item.id,
      label: item.label,
      decision: "blocked",
      layer: "local",
      releasedForm: "none",
      consentRequired: false,
      reason: "The scenario marks this data as outside the allowed processing boundary.",
      policyTags: [...tags, "scenario:block"]
    };
  }

  if (item.allowedLayers.length === 1 && item.allowedLayers[0] === "local") {
    return {
      dataItemId: item.id,
      label: item.label,
      decision: "local_only",
      layer: "local",
      releasedForm: "local memory reference only",
      consentRequired: false,
      reason: "The data is useful for reasoning but the policy restricts it to on-device processing.",
      policyTags: [...tags, "layer:local-only"]
    };
  }

  // Only genuinely low-sensitivity, non-PII data may leave the device as an
  // aggregate without an explicit consent gate. Confidential/sensitive/regulated
  // items fall through to the consent branch even when marked safe_aggregate, so
  // a fixture (or adversarial submitter) cannot auto-release a high-sensitivity
  // item to a higher layer by setting `containsPii: false`.
  if (
    item.defaultBoundary === "safe_aggregate" &&
    !item.containsPii &&
    !sensitiveLevels.has(item.sensitivity)
  ) {
    return {
      dataItemId: item.id,
      label: item.label,
      decision: "safe_aggregate",
      layer: targetLayer,
      releasedForm: "aggregate or redacted summary",
      consentRequired: false,
      reason:
        "The item is already minimized and non-identifying, so it can be used beyond the local layer as an aggregate.",
      policyTags: [...tags, "minimized:aggregate"]
    };
  }

  if (item.defaultBoundary === "requires_consent" || targetLayer !== "local") {
    return {
      dataItemId: item.id,
      label: item.label,
      decision: granted ? "safe_aggregate" : "requires_consent",
      layer: targetLayer,
      releasedForm: granted ? "user-approved minimized payload" : "withheld until user approval",
      consentRequired: !granted,
      reason: granted
        ? "The user granted consent, and only the minimized representation is released."
        : "The data can cross a boundary only after explicit user approval.",
      policyTags: [...tags, "consent:explicit"]
    };
  }

  return {
    dataItemId: item.id,
    label: item.label,
    decision: "local_only",
    layer: "local",
    releasedForm: "local memory reference only",
    consentRequired: false,
    reason: "The safest useful default is local processing with no boundary crossing.",
    policyTags: [...tags, "default:local-first"]
  };
}

export function evaluateScenarioGovernance(
  scenario: Scenario,
  consentState: ConsentState = {}
): GovernanceDecision[] {
  return scenario.dataItems.map((item) => evaluateDataItem(item, scenario, consentState));
}

export function permissionRequestsFromDecisions(
  decisions: GovernanceDecision[]
): PermissionRequest[] {
  return decisions
    .filter((decision) => decision.decision === "requires_consent")
    .map((decision) => ({
      dataItemId: decision.dataItemId,
      label: decision.label,
      requestedLayer: decision.layer,
      reason: decision.reason,
      status: "pending"
    }));
}

export function boundaryRank(decision: BoundaryDecision): number {
  switch (decision) {
    case "blocked":
      return 0;
    case "local_only":
      return 1;
    case "requires_consent":
      return 2;
    case "safe_aggregate":
      return 3;
  }
}

export function canCrossLayer(item: DataItem, targetLayer: LayerId, consentState: ConsentState = {}): boolean {
  if (!item.allowedLayers.includes(targetLayer)) {
    return false;
  }
  if (targetLayer === "local") {
    return true;
  }
  if (item.defaultBoundary === "blocked" || item.defaultBoundary === "local_only") {
    return false;
  }
  if (item.defaultBoundary === "requires_consent") {
    return consentState[item.id] === true;
  }
  return item.defaultBoundary === "safe_aggregate" && !item.containsPii && !sensitiveLevels.has(item.sensitivity);
}
