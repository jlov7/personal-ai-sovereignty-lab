import {
  createConsentReceipt,
  evaluateEgressAttempt,
  revokeConsentReceipt,
  type EgressDecision,
  type ReleaseForm
} from "../privacy/egressGuard";
import type { DataItem, LayerId, Scenario } from "../shared/types";

export interface EnforcementProbeResult {
  id: string;
  scenarioId: string;
  dataItemId: string;
  expectedAllowed: boolean;
  observedAllowed: boolean;
  passed: boolean;
  reason: string;
  controls: string[];
}

export interface EnforcementReport {
  benchmark: string;
  version: string;
  generatedAt: string;
  scenarioCount: number;
  probeCount: number;
  passed: number;
  failed: number;
  passRate: number;
  probes: EnforcementProbeResult[];
  limitations: string[];
}

const NOW = "2026-05-22T00:00:00.000Z";

function firstProtectedItem(scenario: Scenario): DataItem {
  return (
    scenario.dataItems.find(
      (item) =>
        item.defaultBoundary === "blocked" ||
        item.defaultBoundary === "local_only" ||
        item.containsPii ||
        item.sensitivity === "regulated" ||
        item.sensitivity === "sensitive" ||
        item.sensitivity === "confidential"
    ) ?? scenario.dataItems[0]
  );
}

function firstConsentItem(scenario: Scenario): DataItem | null {
  return scenario.dataItems.find((item) => item.defaultBoundary === "requires_consent") ?? null;
}

function firstAggregateItem(scenario: Scenario): DataItem | null {
  return scenario.dataItems.find((item) => item.defaultBoundary === "safe_aggregate" && !item.containsPii) ?? null;
}

function targetLayerFor(item: DataItem): LayerId {
  return item.allowedLayers.find((layer) => layer !== "local") ?? "personal_cloud";
}

function toProbe(
  id: string,
  scenario: Scenario,
  item: DataItem,
  expectedAllowed: boolean,
  decision: EgressDecision
): EnforcementProbeResult {
  return {
    id,
    scenarioId: scenario.id,
    dataItemId: item.id,
    expectedAllowed,
    observedAllowed: decision.allowed,
    passed: expectedAllowed === decision.allowed,
    reason: decision.reason,
    controls: decision.controls
  };
}

function attempt(
  scenario: Scenario,
  item: DataItem,
  targetLayer: LayerId,
  releaseForm: ReleaseForm,
  purpose: string
) {
  return {
    scenarioId: scenario.id,
    dataItemId: item.id,
    targetLayer,
    releaseForm,
    purpose,
    attemptedAt: NOW
  };
}

export function runEnforcementProbes(scenarios: Scenario[]): EnforcementProbeResult[] {
  return scenarios.flatMap((scenario) => {
    const protectedItem = firstProtectedItem(scenario);
    const consentItem = firstConsentItem(scenario);
    const aggregateItem = firstAggregateItem(scenario);
    const protectedTarget = targetLayerFor(protectedItem);
    const probes: EnforcementProbeResult[] = [];

    probes.push(
      toProbe(
        "raw-protected-egress-blocked",
        scenario,
        protectedItem,
        false,
        evaluateEgressAttempt(
          scenario,
          attempt(
            scenario,
            protectedItem,
            protectedTarget,
            "raw_payload",
            "Attempt to send raw protected context outside the local boundary."
          )
        )
      )
    );

    if (consentItem) {
      const targetLayer = targetLayerFor(consentItem);
      const validReceipt = createConsentReceipt(
        scenario,
        consentItem.id,
        targetLayer,
        "minimized_payload",
        "User-approved minimum necessary payload."
      );
      const revokedReceipt = revokeConsentReceipt(
        validReceipt,
        "2026-05-22T00:30:00.000Z",
        "User revoked this consent before egress."
      );
      const expiredReceipt = createConsentReceipt(
        scenario,
        consentItem.id,
        targetLayer,
        "minimized_payload",
        "Expired consent fixture.",
        { grantedAt: "2026-05-01T00:00:00.000Z", ttlDays: 1 }
      );

      probes.push(
        toProbe(
          "minimized-egress-with-valid-receipt",
          scenario,
          consentItem,
          true,
          evaluateEgressAttempt(scenario, {
            ...attempt(
              scenario,
              consentItem,
              targetLayer,
              "minimized_payload",
              "User-approved minimum necessary payload."
            ),
            consentReceipt: validReceipt
          })
        )
      );
      probes.push(
        toProbe(
          "revoked-consent-blocked",
          scenario,
          consentItem,
          false,
          evaluateEgressAttempt(scenario, {
            ...attempt(
              scenario,
              consentItem,
              targetLayer,
              "minimized_payload",
              "User-approved minimum necessary payload."
            ),
            consentReceipt: revokedReceipt
          })
        )
      );
      probes.push(
        toProbe(
          "expired-consent-blocked",
          scenario,
          consentItem,
          false,
          evaluateEgressAttempt(scenario, {
            ...attempt(
              scenario,
              consentItem,
              targetLayer,
              "minimized_payload",
              "Expired consent fixture."
            ),
            consentReceipt: expiredReceipt
          })
        )
      );
    }

    if (aggregateItem) {
      probes.push(
        toProbe(
          "safe-aggregate-egress-without-receipt",
          scenario,
          aggregateItem,
          true,
          evaluateEgressAttempt(
            scenario,
            attempt(
              scenario,
              aggregateItem,
              targetLayerFor(aggregateItem),
              "aggregate",
              "Non-identifying aggregate comparison."
            )
          )
        )
      );
    }

    return probes;
  });
}

export function buildEnforcementReport(scenarios: Scenario[]): EnforcementReport {
  const probes = runEnforcementProbes(scenarios);
  const passed = probes.filter((probe) => probe.passed).length;

  return {
    benchmark: "personal-ai-sovereignty-benchmark",
    version: "0.5.0-enforcement-simulation",
    generatedAt: NOW,
    scenarioCount: scenarios.length,
    probeCount: probes.length,
    passed,
    failed: probes.length - passed,
    passRate: probes.length === 0 ? 0 : passed / probes.length,
    probes,
    limitations: [
      "The egress guard is an executable simulation, not OS-level network enforcement.",
      "Consent receipts are tamper-evident hashes, not legally binding signatures.",
      "Retention deadlines are evaluated as policy fixtures; no storage backend is present."
    ]
  };
}

export function renderEnforcementReportMarkdown(report: EnforcementReport): string {
  const failures = report.probes.filter((probe) => !probe.passed);

  return `# Egress Enforcement Report

Generated by \`pnpm eval\`.

## Summary

- Scenario count: ${report.scenarioCount}
- Probe count: ${report.probeCount}
- Passed: ${report.passed}
- Failed: ${report.failed}
- Pass rate: ${(report.passRate * 100).toFixed(1)}%

## Probe Families

- Raw protected egress must be blocked.
- Minimized boundary crossing must require a valid active consent receipt.
- Revoked consent must block egress.
- Expired consent must block egress.
- Safe aggregate egress may proceed without a receipt only when non-identifying and layer-allowed.

## Failures

${failures
  .map((failure) => `- ${failure.scenarioId} / ${failure.id}: ${failure.reason}`)
  .join("\n") || "- No failed enforcement probes."}

## Limitations

${report.limitations.map((limitation) => `- ${limitation}`).join("\n")}
`;
}
