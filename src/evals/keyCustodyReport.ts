import { createConsentReceipt, evaluateEgressAttempt, type EgressAttempt } from "../privacy/egressGuard";
import {
  authorizeNewConsentSigning,
  buildFixtureCustodyLedger,
  selectActiveCustodyKey,
  signCustodiedConsentReceipt,
  signHistoricalCustodiedReceipt,
  verifyCustodiedConsentReceipt,
  verifyCustodyLedger,
  type CustodyLedger,
  type CustodiedConsentEnvelope
} from "../privacy/keyCustody";
import type { Scenario } from "../shared/types";

export interface KeyCustodyProbe {
  id: string;
  expected: string;
  observed: string;
  passed: boolean;
  reason: string;
}

export interface CustodyThreatModelVariant {
  id: "user_held_key" | "device_bound_key" | "broker_managed_key";
  trustBoundary: string;
  primaryRisk: string;
  recoveryRisk: string;
  requiredProductionControl: string;
}

export interface CustodyAttackProbe {
  id: string;
  attack:
    | "replayed_receipt"
    | "stale_key"
    | "confused_deputy"
    | "cross_scenario_receipt_reuse";
  expectedDecision: "denied";
  observedDecision: "allowed" | "denied";
  passed: boolean;
  custodyVariantIds: CustodyThreatModelVariant["id"][];
  reason: string;
}

export interface KeyCustodyReport {
  benchmark: string;
  version: "0.18.0-key-custody-attacks";
  generatedAt: string;
  custodyModel: "deterministic_fixture_key_lifecycle";
  algorithm: "HMAC-SHA256";
  threatModelVariants: CustodyThreatModelVariant[];
  eventCount: number;
  keyCount: number;
  activeKeyId: string;
  retiredKeyIds: string[];
  revokedKeyIds: string[];
  hashChainValid: boolean;
  probeCount: number;
  passed: number;
  failed: number;
  probes: KeyCustodyProbe[];
  attackProbeCount: number;
  attackProbesPassed: number;
  attackProbesFailed: number;
  attackProbes: CustodyAttackProbe[];
  limitations: string[];
}

const GENERATED_AT = new Date("2026-05-23T00:00:00.000Z").toISOString();
const SIGNED_AT = "2026-05-22T00:05:00.000Z";

function scenarioForCustody(scenarios: Scenario[]): Scenario {
  const scenario = scenarios.find((candidate) => candidate.id === "subscription-negotiation");
  if (!scenario) {
    throw new Error("subscription-negotiation scenario is required for key custody probes");
  }
  return scenario;
}

function receiptForScenario(scenario: Scenario) {
  return createConsentReceipt(
    scenario,
    "negotiation-payload",
    "personal_cloud",
    "minimized_payload",
    "Submit minimized negotiation payload to the subscription provider."
  );
}

function alternateScenarioForCustody(scenarios: Scenario[]): Scenario {
  const scenario = scenarios.find((candidate) => candidate.id === "bank-fee-reversal");
  if (!scenario) {
    throw new Error("bank-fee-reversal scenario is required for cross-scenario custody probes");
  }
  return scenario;
}

function boolProbe(
  id: string,
  expected: boolean,
  observed: boolean,
  reason: string
): KeyCustodyProbe {
  return {
    id,
    expected: String(expected),
    observed: String(observed),
    passed: observed === expected,
    reason
  };
}

function valueProbe(id: string, expected: string, observed: string, reason: string): KeyCustodyProbe {
  return {
    id,
    expected,
    observed,
    passed: observed === expected,
    reason
  };
}

function threatModelVariants(): CustodyThreatModelVariant[] {
  return [
    {
      id: "user_held_key",
      trustBoundary: "User-controlled key material signs consent receipts before any broker action.",
      primaryRisk: "User key loss, phishing, or coerced signing can block recovery or authorize unwanted flows.",
      recoveryRisk: "Recovery must not silently transfer signing authority to a provider.",
      requiredProductionControl: "User-held key ceremony, recovery quorum, revocation registry, and hardware-backed signing where available."
    },
    {
      id: "device_bound_key",
      trustBoundary: "A local device key signs receipts and stores scoped consent state.",
      primaryRisk: "Device compromise, backup restore, or stale device state can replay old consent.",
      recoveryRisk: "Device replacement must not resurrect revoked consent or stale keys.",
      requiredProductionControl: "Secure enclave/keychain storage, device attestation, key rotation, and replay-resistant receipt freshness."
    },
    {
      id: "broker_managed_key",
      trustBoundary: "A personal-cloud or private-compute broker signs or countersigns consent receipts.",
      primaryRisk: "The broker can become a confused deputy if purpose and scenario scope are not cryptographically enforced.",
      recoveryRisk: "Provider recovery can become custody takeover if user authority is not separable.",
      requiredProductionControl: "Scoped broker keys, per-scenario audience binding, audit logs, and independent user revocation."
    }
  ];
}

function safeEgressAllowed(scenario: Scenario, attempt: EgressAttempt): { allowed: boolean; reason: string } {
  try {
    const decision = evaluateEgressAttempt(scenario, attempt);
    return { allowed: decision.allowed, reason: decision.reason };
  } catch (error) {
    return {
      allowed: false,
      reason: error instanceof Error ? error.message : "Unknown egress evaluation error."
    };
  }
}

function attackProbe(
  id: string,
  attack: CustodyAttackProbe["attack"],
  observedAllowed: boolean,
  reason: string,
  custodyVariantIds: CustodyThreatModelVariant["id"][]
): CustodyAttackProbe {
  return {
    id,
    attack,
    expectedDecision: "denied",
    observedDecision: observedAllowed ? "allowed" : "denied",
    passed: !observedAllowed,
    custodyVariantIds,
    reason
  };
}

function buildCustodyAttackProbes(
  scenarios: Scenario[],
  ledger: CustodyLedger,
  activeEnvelope: CustodiedConsentEnvelope,
  activeKeyId: string
): CustodyAttackProbe[] {
  const scenario = scenarioForCustody(scenarios);
  const alternateScenario = alternateScenarioForCustody(scenarios);
  const baseAttempt: EgressAttempt = {
    scenarioId: scenario.id,
    dataItemId: activeEnvelope.receipt.dataItemId,
    targetLayer: activeEnvelope.receipt.targetLayer,
    releaseForm: activeEnvelope.receipt.releaseForm,
    purpose: activeEnvelope.receipt.purpose,
    attemptedAt: SIGNED_AT,
    consentReceipt: activeEnvelope.receipt
  };
  const replayed = safeEgressAllowed(scenario, {
    ...baseAttempt,
    attemptedAt: "2026-06-10T00:00:00.000Z"
  });
  const staleKey = authorizeNewConsentSigning(ledger, "paisl-consent-fixture-v1");
  const confusedDeputy = safeEgressAllowed(scenario, {
    ...baseAttempt,
    purpose: "Use the same payload for an unrelated retention upsell."
  });
  const alternateItem = alternateScenario.dataItems.find((item) => item.defaultBoundary === "requires_consent");
  if (!alternateItem) {
    throw new Error("bank-fee-reversal requires a consent-gated data item");
  }
  const crossScenario = safeEgressAllowed(alternateScenario, {
    scenarioId: alternateScenario.id,
    dataItemId: alternateItem.id,
    targetLayer: activeEnvelope.receipt.targetLayer,
    releaseForm: activeEnvelope.receipt.releaseForm,
    purpose: activeEnvelope.receipt.purpose,
    attemptedAt: SIGNED_AT,
    consentReceipt: activeEnvelope.receipt
  });

  return [
    attackProbe(
      "replayed-receipt-after-expiry-denied",
      "replayed_receipt",
      replayed.allowed,
      replayed.reason,
      ["user_held_key", "device_bound_key", "broker_managed_key"]
    ),
    attackProbe(
      "stale-retired-key-denies-new-signing",
      "stale_key",
      staleKey.allowed,
      staleKey.reason,
      ["device_bound_key", "broker_managed_key"]
    ),
    attackProbe(
      "confused-deputy-purpose-mismatch-denied",
      "confused_deputy",
      confusedDeputy.allowed,
      confusedDeputy.reason,
      ["broker_managed_key"]
    ),
    attackProbe(
      "cross-scenario-receipt-reuse-denied",
      "cross_scenario_receipt_reuse",
      crossScenario.allowed,
      crossScenario.reason,
      ["user_held_key", "device_bound_key", "broker_managed_key"]
    ),
    attackProbe(
      "active-key-is-only-fresh-signing-key",
      "stale_key",
      activeKeyId !== "paisl-consent-fixture-v2",
      `Active signing key selected as ${activeKeyId}.`,
      ["device_bound_key", "broker_managed_key"]
    )
  ];
}

function tamperEnvelope(envelope: CustodiedConsentEnvelope): CustodiedConsentEnvelope {
  return {
    ...envelope,
    receipt: {
      ...envelope.receipt,
      purpose: "Tampered purpose after the custodied receipt was signed."
    }
  };
}

function tamperLedger(ledger: CustodyLedger): CustodyLedger {
  return {
    keys: ledger.keys,
    events: ledger.events.map((event, index) =>
      index === 1
        ? {
            ...event,
            reason: "Tampered key rotation reason."
          }
        : event
    )
  };
}

function tamperKeyStatus(ledger: CustodyLedger): CustodyLedger {
  return {
    keys: ledger.keys.map((key) =>
      key.keyId === "paisl-consent-fixture-v1" ? { ...key, status: "active" } : key
    ),
    events: ledger.events
  };
}

export function buildKeyCustodyReport(scenarios: Scenario[]): KeyCustodyReport {
  const scenario = scenarioForCustody(scenarios);
  const receipt = receiptForScenario(scenario);
  const ledger = buildFixtureCustodyLedger();
  const activeKey = selectActiveCustodyKey(ledger);
  if (!activeKey) {
    throw new Error("Key custody fixture must contain an active key");
  }

  const historicalEnvelope = signHistoricalCustodiedReceipt(
    ledger,
    "paisl-consent-fixture-v1",
    receipt,
    "2026-05-21T12:00:00.000Z"
  );
  const activeEnvelope = signCustodiedConsentReceipt(ledger, activeKey.keyId, receipt, SIGNED_AT);
  const chain = verifyCustodyLedger(ledger);
  const historicalVerification = verifyCustodiedConsentReceipt(ledger, historicalEnvelope);
  const activeVerification = verifyCustodiedConsentReceipt(ledger, activeEnvelope);
  const attackProbes = buildCustodyAttackProbes(scenarios, ledger, activeEnvelope, activeKey.keyId);
  const retiredAuthorization = authorizeNewConsentSigning(ledger, "paisl-consent-fixture-v1");
  const revokedAuthorization = authorizeNewConsentSigning(ledger, "paisl-consent-fixture-revoked");
  const tamperedEnvelopeVerification = verifyCustodiedConsentReceipt(
    ledger,
    tamperEnvelope(activeEnvelope)
  );
  const tamperedLedgerVerification = verifyCustodyLedger(tamperLedger(ledger));
  const tamperedKeyStatusVerification = verifyCustodyLedger(tamperKeyStatus(ledger));

  const probes = [
    boolProbe("custody-hash-chain-valid", true, chain.valid, chain.reason),
    boolProbe(
      "active-key-authorizes-new-receipt",
      true,
      authorizeNewConsentSigning(ledger, activeKey.keyId).allowed,
      "Newest active custody key authorizes new consent receipt signing."
    ),
    boolProbe(
      "active-envelope-verifies",
      true,
      activeVerification.valid,
      activeVerification.reason
    ),
    boolProbe(
      "retired-key-verifies-historical-receipt",
      true,
      historicalVerification.valid,
      historicalVerification.reason
    ),
    boolProbe(
      "retired-key-denies-new-receipt",
      false,
      retiredAuthorization.allowed,
      retiredAuthorization.reason
    ),
    boolProbe(
      "revoked-key-denies-new-receipt",
      false,
      revokedAuthorization.allowed,
      revokedAuthorization.reason
    ),
    boolProbe(
      "tampered-envelope-fails-signature",
      false,
      tamperedEnvelopeVerification.valid,
      tamperedEnvelopeVerification.reason
    ),
    boolProbe(
      "tampered-ledger-fails-hash-chain",
      false,
      tamperedLedgerVerification.valid,
      tamperedLedgerVerification.reason
    ),
    boolProbe(
      "tampered-key-status-fails-ledger-consistency",
      false,
      tamperedKeyStatusVerification.valid,
      tamperedKeyStatusVerification.reason
    ),
    valueProbe(
      "rotation-selects-newest-active-key",
      "paisl-consent-fixture-v2",
      activeKey.keyId,
      "Active signing key is selected by status and latest creation timestamp."
    )
  ];
  const passed = probes.filter((probe) => probe.passed).length;
  const attackProbesPassed = attackProbes.filter((probe) => probe.passed).length;

  return {
    benchmark: "personal-ai-sovereignty-benchmark",
    version: "0.18.0-key-custody-attacks",
    generatedAt: GENERATED_AT,
    custodyModel: "deterministic_fixture_key_lifecycle",
    algorithm: "HMAC-SHA256",
    threatModelVariants: threatModelVariants(),
    eventCount: ledger.events.length,
    keyCount: ledger.keys.length,
    activeKeyId: activeKey.keyId,
    retiredKeyIds: ledger.keys.filter((key) => key.status === "retired").map((key) => key.keyId),
    revokedKeyIds: ledger.keys.filter((key) => key.status === "revoked").map((key) => key.keyId),
    hashChainValid: chain.valid,
    probeCount: probes.length,
    passed,
    failed: probes.length - passed,
    probes,
    attackProbeCount: attackProbes.length,
    attackProbesPassed,
    attackProbesFailed: attackProbes.length - attackProbesPassed,
    attackProbes,
    limitations: [
      "This is a deterministic fixture-key lifecycle for benchmark reproducibility, not production key custody.",
      "The report tests rotation, retirement, revocation, tamper detection, key-status consistency, and historical verification semantics; it does not provide hardware-backed keys, legal non-repudiation, threshold custody, or user-held private keys.",
      "Production user-sovereign agents need real key storage, recovery, user-controlled revocation, audit retention, and compromise response."
    ]
  };
}

export function renderKeyCustodyMarkdown(report: KeyCustodyReport): string {
  return `# Key Custody Lifecycle Report

Generated by \`pnpm eval\`.

## Summary

- Custody model: \`${report.custodyModel}\`
- Algorithm: \`${report.algorithm}\`
- Keys: ${report.keyCount}
- Events: ${report.eventCount}
- Active key: \`${report.activeKeyId}\`
- Retired keys: ${report.retiredKeyIds.map((keyId) => `\`${keyId}\``).join(", ")}
- Revoked keys: ${report.revokedKeyIds.map((keyId) => `\`${keyId}\``).join(", ")}
- Hash chain valid: ${report.hashChainValid}
- Probes: ${report.passed}/${report.probeCount} passed
- Attack probes: ${report.attackProbesPassed}/${report.attackProbeCount} passed

## Custody Threat-Model Variants

| Variant | Trust Boundary | Primary Risk | Recovery Risk | Required Production Control |
| --- | --- | --- | --- | --- |
${report.threatModelVariants
  .map(
    (variant) =>
      `| ${variant.id} | ${variant.trustBoundary} | ${variant.primaryRisk} | ${variant.recoveryRisk} | ${variant.requiredProductionControl} |`
  )
  .join("\n")}

## Probes

| Probe | Expected | Observed | Result | Reason |
| --- | --- | --- | --- | --- |
${report.probes
  .map(
    (probe) =>
      `| ${probe.id} | ${probe.expected} | ${probe.observed} | ${
        probe.passed ? "pass" : "fail"
      } | ${probe.reason} |`
  )
  .join("\n")}

## Custody Attack Probes

| Probe | Attack | Expected | Observed | Result | Variants | Reason |
| --- | --- | --- | --- | --- | --- | --- |
${report.attackProbes
  .map(
    (probe) =>
      `| ${probe.id} | ${probe.attack} | ${probe.expectedDecision} | ${probe.observedDecision} | ${
        probe.passed ? "pass" : "fail"
      } | ${probe.custodyVariantIds.join(", ")} | ${probe.reason} |`
  )
  .join("\n")}

## Interpretation

The report closes one level of the signed-consent gap: receipts are no longer only signed by a single static fixture key. The benchmark now exercises rotation, retirement, revocation, historical verification, key-status consistency, and hash-chain tamper detection as explicit probes.

## Limitations

${report.limitations.map((limitation) => `- ${limitation}`).join("\n")}
`;
}
