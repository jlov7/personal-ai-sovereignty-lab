import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FileConsentLedger, recordConsentGrant, recordConsentRevocation } from "../privacy/consentLedger";
import { SovereignFetch, type MinimalFetchResponse, type SovereignFetchResult } from "../privacy/sovereignFetch";
import type { Scenario } from "../shared/types";

export interface StorageBackedEnforcementProbe {
  id: string;
  expectedAllowed: boolean;
  expectedFetchExecuted: boolean;
  observedAllowed: boolean;
  observedFetchExecuted: boolean;
  passed: boolean;
  reason: string;
  controls: string[];
}

export interface StorageBackedEnforcementReport {
  benchmark: string;
  version: string;
  generatedAt: string;
  ledgerPath: string;
  auditLogPath: string;
  ledgerEventCount: number;
  auditEventCount: number;
  probeCount: number;
  passed: number;
  failed: number;
  probes: StorageBackedEnforcementProbe[];
  limitations: string[];
}

const GENERATED_AT = "2026-05-22T00:00:00.000Z";

function readJsonlCount(contents: string): number {
  return contents.split("\n").filter((line) => line.trim().length > 0).length;
}

function probeFromResult(
  id: string,
  result: SovereignFetchResult,
  expectedAllowed: boolean,
  expectedFetchExecuted: boolean
): StorageBackedEnforcementProbe {
  const passed =
    result.allowed === expectedAllowed && result.fetchExecuted === expectedFetchExecuted;
  return {
    id,
    expectedAllowed,
    expectedFetchExecuted,
    observedAllowed: result.allowed,
    observedFetchExecuted: result.fetchExecuted,
    passed,
    reason: result.finalReason,
    controls: result.controls
  };
}

function findPublicationScenario(scenarios: Scenario[]): Scenario {
  const scenario = scenarios.find((candidate) => candidate.id === "subscription-negotiation");
  if (!scenario) {
    throw new Error("subscription-negotiation scenario is required for storage enforcement report");
  }
  return scenario;
}

export async function buildStorageBackedEnforcementReport(
  root: string,
  scenarios: Scenario[]
): Promise<StorageBackedEnforcementReport> {
  const ledgerPath = resolve(root, "outputs/runtime_consent_ledger.jsonl");
  const auditLogPath = resolve(root, "outputs/runtime_egress_audit.jsonl");
  const ledger = new FileConsentLedger(ledgerPath);
  const scenario = findPublicationScenario(scenarios);
  let fetchCallCount = 0;
  const fetchImpl = async (): Promise<MinimalFetchResponse> => {
    fetchCallCount += 1;
    return {
      status: 202,
      async text(): Promise<string> {
        return "accepted";
      }
    };
  };
  const sovereignFetch = new SovereignFetch(
    ledger,
    auditLogPath,
    fetchImpl,
    new Set(["provider.example"])
  );

  await ledger.reset();
  await writeFile(auditLogPath, "");

  const receipt = await recordConsentGrant(
    ledger,
    scenario,
    "negotiation-payload",
    "federated",
    "minimized_payload",
    "Provider-facing negotiation payload.",
    { recordedAt: GENERATED_AT }
  );

  const allowedMinimized = await sovereignFetch.request({
    id: "storage-backed-minimized-allowed",
    scenario,
    dataItemId: "negotiation-payload",
    targetLayer: "federated",
    targetUrl: "https://provider.example/negotiation",
    releaseForm: "minimized_payload",
    purpose: "Provider-facing negotiation payload.",
    attemptedAt: GENERATED_AT,
    payload: { floor: "current plan price", ceiling: "redacted user-approved maximum" }
  });

  const rawBlocked = await sovereignFetch.request({
    id: "storage-backed-raw-blocked",
    scenario,
    dataItemId: "willingness-to-pay",
    targetLayer: "federated",
    targetUrl: "https://provider.example/negotiation",
    releaseForm: "raw_payload",
    purpose: "Provider asks for the user's maximum willingness to pay.",
    attemptedAt: GENERATED_AT,
    payload: { rawWillingnessToPay: "blocked synthetic fixture value" }
  });

  const hostBlocked = await sovereignFetch.request({
    id: "storage-backed-host-blocked",
    scenario,
    dataItemId: "negotiation-payload",
    targetLayer: "federated",
    targetUrl: "https://untrusted.example/negotiation",
    releaseForm: "minimized_payload",
    purpose: "Provider-facing negotiation payload.",
    attemptedAt: GENERATED_AT,
    payload: { floor: "current plan price", ceiling: "redacted user-approved maximum" }
  });

  await recordConsentRevocation(
    ledger,
    receipt.id,
    "2026-05-22T01:00:00.000Z",
    "User revoked provider negotiation consent."
  );

  const revokedBlocked = await sovereignFetch.request({
    id: "storage-backed-revoked-blocked",
    scenario,
    dataItemId: "negotiation-payload",
    targetLayer: "federated",
    targetUrl: "https://provider.example/negotiation",
    releaseForm: "minimized_payload",
    purpose: "Provider-facing negotiation payload.",
    attemptedAt: "2026-05-22T01:01:00.000Z",
    payload: { floor: "current plan price", ceiling: "redacted user-approved maximum" }
  });

  if (fetchCallCount !== 1) {
    throw new Error(`Expected exactly one outbound fetch in storage-backed report; saw ${fetchCallCount}`);
  }

  const probes = [
    probeFromResult("minimized-payload-with-stored-consent", allowedMinimized, true, true),
    probeFromResult("raw-protected-payload-blocked-before-fetch", rawBlocked, false, false),
    probeFromResult("untrusted-host-blocked-before-fetch", hostBlocked, false, false),
    probeFromResult("revoked-stored-consent-blocked-before-fetch", revokedBlocked, false, false)
  ];
  const passed = probes.filter((probe) => probe.passed).length;
  const ledgerEventCount = readJsonlCount(await readFile(ledgerPath, "utf8"));
  const auditEventCount = readJsonlCount(await readFile(auditLogPath, "utf8"));

  return {
    benchmark: "personal-ai-sovereignty-benchmark",
    version: "0.6.0-storage-backed-enforcement",
    generatedAt: GENERATED_AT,
    ledgerPath: "outputs/runtime_consent_ledger.jsonl",
    auditLogPath: "outputs/runtime_egress_audit.jsonl",
    ledgerEventCount,
    auditEventCount,
    probeCount: probes.length,
    passed,
    failed: probes.length - passed,
    probes,
    limitations: [
      "This is application-level fetch mediation, not an operating-system firewall.",
      "The probe uses synthetic payloads and a mock fetch implementation so no external network request is made during pnpm eval.",
      "A production implementation would need process sandboxing, key management, durable revocation storage, and audit-log integrity controls."
    ]
  };
}

export function renderStorageBackedEnforcementMarkdown(
  report: StorageBackedEnforcementReport
): string {
  return `# Storage-Backed Runtime Enforcement Report

Generated by \`pnpm eval\`.

## Summary

- Version: ${report.version}
- Ledger path: \`${report.ledgerPath}\`
- Audit log path: \`${report.auditLogPath}\`
- Ledger events: ${report.ledgerEventCount}
- Audit events: ${report.auditEventCount}
- Probes: ${report.passed}/${report.probeCount} passed

## Probes

| Probe | Expected Allowed | Observed Allowed | Fetch Executed | Result | Reason |
| --- | --- | --- | --- | --- | --- |
${report.probes
  .map(
    (probe) =>
      `| ${probe.id} | ${probe.expectedAllowed} | ${probe.observedAllowed} | ${probe.observedFetchExecuted} | ${
        probe.passed ? "pass" : "fail"
      } | ${probe.reason} |`
  )
  .join("\n")}

## Controls Observed

${report.probes
  .map((probe) => `- ${probe.id}: ${probe.controls.map((control) => `\`${control}\``).join(", ")}`)
  .join("\n")}

## Limitations

${report.limitations.map((limitation) => `- ${limitation}`).join("\n")}
`;
}
