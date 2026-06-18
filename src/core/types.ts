export type LayerId = "local" | "personal_cloud" | "federated";

export type BoundaryDecision =
  | "local_only"
  | "requires_consent"
  | "safe_aggregate"
  | "blocked";

export type Sensitivity =
  | "public"
  | "personal"
  | "confidential"
  | "sensitive"
  | "regulated";

export type ScenarioDomain =
  | "knowledge_work"
  | "finance_like_planning"
  | "health_like_sensitive"
  | "education"
  | "customer_agent_negotiation"
  | "household_admin"
  | "career";

export type AutonomyLevel = "advise_only" | "draft_for_review" | "act_with_consent";

export type ActionStatus = "completed" | "needs_user_approval" | "blocked";

export interface DataItem {
  id: string;
  label: string;
  description: string;
  sensitivity: Sensitivity;
  subject: string;
  containsPii: boolean;
  defaultBoundary: BoundaryDecision;
  allowedLayers: LayerId[];
  purpose: string;
  dataVolume: number;
}

export interface SuccessCheck {
  kind: "answer_contains" | "answer_field_present" | "tool_called" | "consent_obtained";
  value: string;
}

export interface Scenario {
  id: string;
  title: string;
  domain: ScenarioDomain;
  summary: string;
  task: string;
  userObjective: string;
  requestedAutonomy: AutonomyLevel;
  architectureLayerFocus: LayerId[];
  dataItems: DataItem[];
  expectedOutputs: string[];
  riskTriggers: string[];
  successCriteria: string[];
  successChecks?: SuccessCheck[];
  failureModes: string[];
  externalInteraction: boolean;
  requiresBoundaryCrossingForSuccess: boolean;
}

export interface ConsentState {
  [dataItemId: string]: boolean;
}

export interface PermissionRequest {
  dataItemId: string;
  label: string;
  requestedLayer: LayerId;
  reason: string;
  status: "pending" | "granted" | "not_required";
}

export interface GovernanceDecision {
  dataItemId: string;
  label: string;
  decision: BoundaryDecision;
  layer: LayerId;
  releasedForm: string;
  consentRequired: boolean;
  reason: string;
  policyTags: string[];
}

export interface AgentAction {
  id: string;
  label: string;
  layer: LayerId;
  purpose: string;
  usesDataItemIds: string[];
  status: ActionStatus;
  explanation: string;
}

export interface DataFlowEvent {
  step: number;
  actor: string;
  layer: LayerId;
  dataItemIds: string[];
  decision: BoundaryDecision;
  description: string;
  consentGate: boolean;
}

export interface AgentRun {
  runId: string;
  timestamp: string;
  scenario: Scenario;
  model: {
    name: string;
    mode: "mocked_local" | "local_http" | "baseline";
    determinism: string;
  };
  decision: string;
  answer: string;
  actions: AgentAction[];
  governanceDecisions: GovernanceDecision[];
  dataFlow: DataFlowEvent[];
  permissionsRequested: PermissionRequest[];
  riskNotes: string[];
  latencyMs: number;
  privacyBudgetUsed: number;
}

export interface ScoreMetric {
  id:
    | "usefulness"
    | "privacy_preservation"
    | "autonomy_appropriateness"
    | "explainability"
    | "latency"
    | "data_minimization"
    | "user_control_alignment"
    | "consented_escalation";
  label: string;
  score: number;
  weight: number;
  rationale: string;
}

export interface EvaluationResult {
  runId: string;
  scenarioId: string;
  totalScore: number;
  grade: "excellent" | "strong" | "mixed" | "weak";
  metrics: ScoreMetric[];
  failureCases: string[];
  improvementNotes: string[];
}
