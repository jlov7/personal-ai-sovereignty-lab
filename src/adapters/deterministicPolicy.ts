import { createOracleModelPlan } from "../models/transcriptPlans";
import type { ConsentState, Scenario } from "../shared/types";
import type { ModelAdapter } from "./types";

export function deterministicPolicyAdapter(
  scenario: Scenario,
  consentState: ConsentState = {}
): ModelAdapter {
  return {
    id: "deterministic:reference-policy",
    evidenceClass: "deterministic",
    async generate(): Promise<{ text: string }> {
      const plan = createOracleModelPlan(scenario, consentState);
      return { text: JSON.stringify(plan.parsed, null, 2) };
    }
  };
}
