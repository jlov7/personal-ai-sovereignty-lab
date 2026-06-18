import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { evaluateEgressAttempt, type EgressDecision, type ReleaseForm } from "./egressGuard";
import { FileConsentLedger } from "./consentLedger";
import type { LayerId, Scenario } from "../shared/types";

export interface MinimalFetchResponse {
  status: number;
  text(): Promise<string>;
}

export type FetchImplementation = (
  url: string,
  init: { method: "POST"; headers: Record<string, string>; body: string }
) => Promise<MinimalFetchResponse>;

export interface SovereignFetchRequest {
  id: string;
  scenario: Scenario;
  dataItemId: string;
  targetLayer: LayerId;
  targetUrl: string;
  releaseForm: ReleaseForm;
  purpose: string;
  attemptedAt: string;
  payload: Record<string, unknown>;
}

export interface SovereignFetchResult {
  requestId: string;
  allowed: boolean;
  fetchExecuted: boolean;
  statusCode: number | null;
  targetHost: string;
  decision: EgressDecision;
  finalReason: string;
  controls: string[];
}

export interface SovereignFetchAuditEvent extends SovereignFetchResult {
  recordedAt: string;
  payloadKeys: string[];
}

export class SovereignFetch {
  constructor(
    private readonly ledger: FileConsentLedger,
    private readonly auditLogPath: string,
    private readonly fetchImpl: FetchImplementation,
    private readonly allowedHosts: Set<string>
  ) {}

  async request(input: SovereignFetchRequest): Promise<SovereignFetchResult> {
    const targetHost = new URL(input.targetUrl).host;
    const receipt = await this.ledger.activeReceiptForAttempt({
      scenarioId: input.scenario.id,
      dataItemId: input.dataItemId,
      targetLayer: input.targetLayer,
      releaseForm: input.releaseForm,
      purpose: input.purpose,
      attemptedAt: input.attemptedAt
    });
    const decision = evaluateEgressAttempt(input.scenario, {
      scenarioId: input.scenario.id,
      dataItemId: input.dataItemId,
      targetLayer: input.targetLayer,
      releaseForm: input.releaseForm,
      purpose: input.purpose,
      attemptedAt: input.attemptedAt,
      consentReceipt: receipt
    });
    const hostAllowed = input.targetLayer === "local" || this.allowedHosts.has(targetHost);
    const allowed = decision.allowed && hostAllowed;
    const controls = hostAllowed ? decision.controls : [...decision.controls, "network:host-deny"];
    const finalReason = hostAllowed
      ? decision.reason
      : `Target host ${targetHost} is not in the runtime egress allowlist.`;
    let statusCode: number | null = null;

    if (allowed) {
      const response = await this.fetchImpl(input.targetUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId: input.id, payload: input.payload })
      });
      statusCode = response.status;
    }

    const result: SovereignFetchResult = {
      requestId: input.id,
      allowed,
      fetchExecuted: allowed,
      statusCode,
      targetHost,
      decision,
      finalReason,
      controls
    };

    await this.writeAuditEvent({
      ...result,
      recordedAt: input.attemptedAt,
      payloadKeys: Object.keys(input.payload).sort()
    });
    return result;
  }

  private async writeAuditEvent(event: SovereignFetchAuditEvent): Promise<void> {
    await mkdir(dirname(this.auditLogPath), { recursive: true });
    await appendFile(this.auditLogPath, `${JSON.stringify(event)}\n`);
  }
}
