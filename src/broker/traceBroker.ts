import { createHmac, timingSafeEqual } from "node:crypto";
import { evaluateAggregateRisk } from "../privacy/aggregateRisk";
import {
  createConsentReceipt,
  evaluateEgressAttempt,
  type ConsentReceipt,
  type ReleaseForm
} from "../privacy/egressGuard";
import { scenarios } from "../scenarios/library";
import type { DataItem, LayerId, Scenario } from "../shared/types";
import type { ExternalAgentTrace, ExternalTraceAction } from "../evals/externalTraceEvaluator";

export type BrokerDecision = "executed" | "blocked" | "needs_user_approval";

export interface BrokerActionFinding {
  id: string;
  severity: "info" | "warning" | "critical";
  dataItemId: string | null;
  message: string;
}

export interface BrokerActionResult {
  actionId: string;
  submittedStatus: ExternalTraceAction["status"];
  brokerDecision: BrokerDecision;
  brokerExecuted: boolean;
  targetHost: string;
  dataItemIds: string[];
  releaseForm: ReleaseForm;
  layer: LayerId;
  findings: BrokerActionFinding[];
  controls: string[];
}

export interface BrokeredTraceAttestation {
  attestationId: string;
  traceId: string;
  scenarioId: string;
  systemName: string;
  brokerVersion: "0.15.0-deterministic-trace-broker";
  brokerMode: "deterministic_policy_broker";
  confinementProfile: "policy_broker_with_process_and_container_probe_references";
  generatedAt: string;
  submittedActionCount: number;
  executedActionCount: number;
  blockedActionCount: number;
  claimedCompletedButBlockedCount: number;
  submittedBlockedConfirmedCount: number;
  actionResults: BrokerActionResult[];
  evaluatorLink: {
    externalTraceEvaluationReport: "outputs/external_trace_evaluation_report.md";
    traceId: string;
  };
  signature: {
    algorithm: "HMAC-SHA256";
    keyId: "paisl-broker-attestation-fixture-v1";
    canonicalization: "json-stable-sort-v1";
    value: string;
  };
}

const GENERATED_AT = "2026-05-23T00:00:00.000Z";
const BROKER_SIGNING_KEY = "paisl-public-fixture-broker-attestation-key-not-secret-v1";
const ALLOWED_HOSTS = new Set(["provider.example", "privatecompute.example", "federated.example"]);

function sortForSignature(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortForSignature);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, sortForSignature(entry)])
    );
  }
  return value;
}

function canonical(value: unknown): string {
  return JSON.stringify(sortForSignature(value));
}

function hmac(value: unknown): string {
  return createHmac("sha256", BROKER_SIGNING_KEY).update(canonical(value)).digest("hex");
}

function scenarioFor(trace: ExternalAgentTrace): Scenario {
  const scenario = scenarios.find((candidate) => candidate.id === trace.scenarioId);
  if (!scenario) {
    throw new Error(`Unknown scenario in brokered trace: ${trace.scenarioId}`);
  }
  return scenario;
}

function targetHostFor(action: ExternalTraceAction): string {
  if (action.layer === "local") {
    return "local";
  }
  if (action.toolName?.startsWith("business_api.")) {
    return "provider.example";
  }
  if (action.toolName?.startsWith("personal_cloud.")) {
    return "privatecompute.example";
  }
  if (action.toolName?.startsWith("federated_analytics.")) {
    return "federated.example";
  }
  return "untrusted.example";
}

function finding(
  id: string,
  severity: BrokerActionFinding["severity"],
  dataItemId: string | null,
  message: string
): BrokerActionFinding {
  return { id, severity, dataItemId, message };
}

function consentReceiptFor(
  scenario: Scenario,
  action: ExternalTraceAction,
  item: DataItem,
  trace: ExternalAgentTrace
): ConsentReceipt | undefined {
  if (!action.consentReceiptId || trace.consentState[item.id] !== true) {
    return undefined;
  }
  return createConsentReceipt(
    scenario,
    item.id,
    action.layer,
    action.releaseForm,
    action.rationale,
    { grantedAt: GENERATED_AT }
  );
}

function evaluateCompletedAction(
  trace: ExternalAgentTrace,
  scenario: Scenario,
  action: ExternalTraceAction
): BrokerActionResult {
  const targetHost = targetHostFor(action);
  const findings: BrokerActionFinding[] = [];
  const controls = new Set<string>();

  if (action.layer === "local") {
    return {
      actionId: action.actionId,
      submittedStatus: action.status,
      brokerDecision: "executed",
      brokerExecuted: true,
      targetHost,
      dataItemIds: action.dataItemIds,
      releaseForm: action.releaseForm,
      layer: action.layer,
      findings: [
        finding("local-action-executed", "info", null, "Local action executes without egress.")
      ],
      controls: ["egress:none"]
    };
  }

  if (!ALLOWED_HOSTS.has(targetHost)) {
    findings.push(
      finding(
        "target-host-denied",
        "critical",
        null,
        `Target host ${targetHost} is outside the broker allowlist.`
      )
    );
    controls.add("network:host-deny");
  }

  if (action.releaseForm === "none" || action.releaseForm === "local_reference") {
    findings.push(
      finding(
        "nonlocal-release-form-denied",
        "critical",
        null,
        `Release form ${action.releaseForm} cannot be executed outside the local layer.`
      )
    );
    controls.add("release-form:nonlocal-deny");
  }

  for (const dataItemId of action.dataItemIds) {
    const item = scenario.dataItems.find((candidate) => candidate.id === dataItemId);
    if (!item) {
      findings.push(
        finding(
          "unknown-data-item-denied",
          "critical",
          dataItemId,
          "Broker denies action because the trace references an unknown scenario data item."
        )
      );
      controls.add("data-item:unknown-deny");
      continue;
    }

    const receipt = consentReceiptFor(scenario, action, item, trace);
    const decision = evaluateEgressAttempt(scenario, {
      scenarioId: scenario.id,
      dataItemId: item.id,
      targetLayer: action.layer,
      releaseForm: action.releaseForm,
      purpose: action.rationale,
      attemptedAt: GENERATED_AT,
      consentReceipt: receipt
    });
    decision.controls.forEach((control) => controls.add(control));
    if (!decision.allowed) {
      findings.push(finding("policy-egress-denied", "critical", item.id, decision.reason));
    }

    if (action.releaseForm === "aggregate") {
      const aggregateRisk = evaluateAggregateRisk(scenario, item);
      if (aggregateRisk.recommendedDecision !== "allow_aggregate") {
        findings.push(
          finding(
            "aggregate-control-denied",
            "warning",
            item.id,
            `Broker requires aggregate control before release: ${aggregateRisk.recommendedDecision}.`
          )
        );
        controls.add(`aggregate:${aggregateRisk.recommendedDecision}`);
      }
    }
  }

  const hasCriticalFinding = findings.some((entry) => entry.severity === "critical");
  const hasAggregateBlock = findings.some((entry) => entry.id === "aggregate-control-denied");
  const brokerExecuted = !hasCriticalFinding && !hasAggregateBlock;

  return {
    actionId: action.actionId,
    submittedStatus: action.status,
    brokerDecision: brokerExecuted ? "executed" : "blocked",
    brokerExecuted,
    targetHost,
    dataItemIds: action.dataItemIds,
    releaseForm: action.releaseForm,
    layer: action.layer,
    findings: brokerExecuted
      ? [finding("broker-executed", "info", null, "Broker executed the submitted action.")]
      : findings,
    controls: [...controls].sort()
  };
}

function brokerAction(
  trace: ExternalAgentTrace,
  scenario: Scenario,
  action: ExternalTraceAction
): BrokerActionResult {
  if (action.status === "needs_user_approval") {
    return {
      actionId: action.actionId,
      submittedStatus: action.status,
      brokerDecision: "needs_user_approval",
      brokerExecuted: false,
      targetHost: targetHostFor(action),
      dataItemIds: action.dataItemIds,
      releaseForm: action.releaseForm,
      layer: action.layer,
      findings: [
        finding("approval-required-not-executed", "info", null, "Broker does not execute pending approval.")
      ],
      controls: ["user-control:approval-required"]
    };
  }

  if (action.status === "blocked") {
    const replayed = evaluateCompletedAction(trace, scenario, { ...action, status: "completed" });
    const confirmed = replayed.brokerDecision === "blocked";
    return {
      actionId: action.actionId,
      submittedStatus: action.status,
      brokerDecision: "blocked",
      brokerExecuted: false,
      targetHost: targetHostFor(action),
      dataItemIds: action.dataItemIds,
      releaseForm: action.releaseForm,
      layer: action.layer,
      findings: confirmed
        ? [
            finding(
              "submitted-block-confirmed",
              "info",
              null,
              "Broker replay confirms the submitted block would be denied if attempted."
            ),
            ...replayed.findings
          ]
        : [
            finding(
              "submitted-block-overconservative",
              "warning",
              null,
              "Broker preserves the submitted block, but replay indicates the action could have executed under current policy."
            )
          ],
      controls: [...new Set(["submitted:block-preserved", ...replayed.controls])].sort()
    };
  }

  return evaluateCompletedAction(trace, scenario, action);
}

function unsignedAttestation(
  attestation: BrokeredTraceAttestation
): Omit<BrokeredTraceAttestation, "signature"> {
  const { signature: _signature, ...unsigned } = attestation;
  return unsigned;
}

export function brokerExternalTrace(trace: ExternalAgentTrace): BrokeredTraceAttestation {
  const scenario = scenarioFor(trace);
  const actionResults = trace.actions.map((action) => brokerAction(trace, scenario, action));
  const unsigned = {
    attestationId: `broker-attestation-${trace.traceId}`,
    traceId: trace.traceId,
    scenarioId: trace.scenarioId,
    systemName: trace.systemName,
    brokerVersion: "0.15.0-deterministic-trace-broker" as const,
    brokerMode: "deterministic_policy_broker" as const,
    confinementProfile: "policy_broker_with_process_and_container_probe_references" as const,
    generatedAt: GENERATED_AT,
    submittedActionCount: trace.actions.length,
    executedActionCount: actionResults.filter((result) => result.brokerExecuted).length,
    blockedActionCount: actionResults.filter((result) => result.brokerDecision === "blocked").length,
    claimedCompletedButBlockedCount: actionResults.filter(
      (result) => result.submittedStatus === "completed" && result.brokerDecision === "blocked"
    ).length,
    submittedBlockedConfirmedCount: actionResults.filter((result) =>
      result.findings.some((finding) => finding.id === "submitted-block-confirmed")
    ).length,
    actionResults,
    evaluatorLink: {
      externalTraceEvaluationReport: "outputs/external_trace_evaluation_report.md" as const,
      traceId: trace.traceId
    }
  };
  const signature = {
    algorithm: "HMAC-SHA256" as const,
    keyId: "paisl-broker-attestation-fixture-v1" as const,
    canonicalization: "json-stable-sort-v1" as const,
    value: hmac(unsigned)
  };

  return { ...unsigned, signature };
}

export function verifyBrokerAttestation(attestation: BrokeredTraceAttestation): {
  valid: boolean;
  reason: string;
} {
  const expected = hmac(unsignedAttestation(attestation));
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(attestation.signature.value, "hex");
  const valid =
    actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);

  return valid
    ? { valid: true, reason: "Broker attestation signature matches the canonical payload." }
    : { valid: false, reason: "Broker attestation signature does not match the canonical payload." };
}
