import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Cloud,
  DatabaseZap,
  GitBranch,
  Lock,
  Network,
  ShieldCheck,
  SlidersHorizontal
} from "lucide-react";
import { runAgent } from "../agent/runAgent";
import { evaluateRun } from "../evals/scorer";
import { evaluateAggregateRisks } from "../privacy/aggregateRisk";
import { publicScenarios } from "../scenarios/library";
import type { BoundaryDecision, ConsentState, LayerId } from "../shared/types";

const layerMeta: Record<LayerId, { label: string; description: string; icon: typeof Brain }> = {
  local: {
    label: "Layer 1",
    description: "On-device intelligence",
    icon: Brain
  },
  personal_cloud: {
    label: "Layer 2",
    description: "Private compute",
    icon: Cloud
  },
  federated: {
    label: "Layer 3",
    description: "Consent-based collective layer",
    icon: Network
  }
};

const decisionLabel: Record<BoundaryDecision, string> = {
  local_only: "Local only",
  requires_consent: "Requires consent",
  safe_aggregate: "Safe aggregate",
  blocked: "Blocked"
};

export function App() {
  const [scenarioId, setScenarioId] = useState(publicScenarios[0].id);
  const [consentState, setConsentState] = useState<ConsentState>({});
  const scenario =
    publicScenarios.find((candidate) => candidate.id === scenarioId) ?? publicScenarios[0];

  const run = useMemo(() => runAgent(scenario, consentState), [scenario, consentState]);
  const evaluation = useMemo(() => evaluateRun(run), [run]);
  const toolTrace = useMemo(
    () => [
      {
        id: `${scenario.id}-local-vault-ui`,
        toolName: "local_vault.search",
        targetLayer: "local" as LayerId,
        releaseForm: "local reference",
        status: "local only",
        policyCompliant: true
      },
      ...run.governanceDecisions
        .filter((decision) => decision.decision === "requires_consent" && consentState[decision.dataItemId])
        .map((decision) => ({
          id: `${decision.dataItemId}-consented-tool-ui`,
          toolName: scenario.externalInteraction
            ? "business_api.submit_minimized_payload"
            : "personal_cloud.compute",
          targetLayer: decision.layer,
          releaseForm: "minimized payload",
          status: "executed",
          policyCompliant: true
        })),
      ...run.governanceDecisions
        .filter((decision) => decision.decision === "safe_aggregate")
        .slice(0, 2)
        .map((decision) => ({
          id: `${decision.dataItemId}-aggregate-tool-ui`,
          toolName: "federated_analytics.submit_aggregate",
          targetLayer: decision.layer,
          releaseForm: "aggregate",
          status: "executed",
          policyCompliant: true
        })),
      {
        id: `${scenario.id}-unsafe-raw-ui`,
        toolName: "external_helper.upload_raw_context",
        targetLayer: scenario.externalInteraction ? ("federated" as LayerId) : ("personal_cloud" as LayerId),
        releaseForm: "raw payload",
        status: "blocked",
        policyCompliant: true
      }
    ],
    [consentState, run.governanceDecisions, scenario]
  );
  const aggregateProbes = useMemo(() => evaluateAggregateRisks([scenario]).slice(0, 4), [scenario]);

  const pendingConsentIds = run.governanceDecisions
    .filter((decision) => decision.decision === "requires_consent")
    .map((decision) => decision.dataItemId);

  function selectScenario(id: string) {
    setScenarioId(id);
    setConsentState({});
  }

  function toggleConsent(dataItemId: string) {
    setConsentState((current) => ({ ...current, [dataItemId]: !current[dataItemId] }));
  }

  return (
    <main className="app-shell">
      <section className="workspace">
        <aside className="scenario-rail" aria-label="Scenario library">
          <div className="brand-lockup">
            <div className="brand-mark">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h1>Personal AI Sovereignty Lab</h1>
              <p>Local-first agent simulation and evaluation harness</p>
            </div>
          </div>

          <div className="scenario-list">
            {publicScenarios.map((candidate) => (
              <button
                className={candidate.id === scenario.id ? "scenario-button active" : "scenario-button"}
                key={candidate.id}
                onClick={() => selectScenario(candidate.id)}
                type="button"
              >
                <span>{candidate.title}</span>
                <small>{candidate.domain.replaceAll("_", " ")}</small>
              </button>
            ))}
          </div>
        </aside>

        <section className="main-panel">
          <header className="topbar">
            <div>
              <p className="section-label">Selected scenario</p>
              <h2>{scenario.title}</h2>
              <p>{scenario.summary}</p>
            </div>
            <div className="score-ring" aria-label={`Evaluation score ${evaluation.totalScore}`}>
              <strong>{evaluation.totalScore}</strong>
              <span>{evaluation.grade}</span>
            </div>
          </header>

          <section className="architecture-strip" aria-label="Three-layer architecture">
            {(Object.keys(layerMeta) as LayerId[]).map((layer) => {
              const Icon = layerMeta[layer].icon;
              const active = scenario.architectureLayerFocus.includes(layer);
              return (
                <div className={active ? "layer-card active" : "layer-card"} key={layer}>
                  <Icon size={20} />
                  <div>
                    <strong>{layerMeta[layer].label}</strong>
                    <span>{layerMeta[layer].description}</span>
                  </div>
                </div>
              );
            })}
          </section>

          <section className="content-grid">
            <article className="panel scenario-card">
              <div className="panel-heading">
                <DatabaseZap size={18} />
                <h3>Task and constraints</h3>
              </div>
              <p className="task-copy">{scenario.task}</p>
              <dl className="facts">
                <div>
                  <dt>User objective</dt>
                  <dd>{scenario.userObjective}</dd>
                </div>
                <div>
                  <dt>Autonomy mode</dt>
                  <dd>{scenario.requestedAutonomy.replaceAll("_", " ")}</dd>
                </div>
              </dl>
            </article>

            <article className="panel decision-card">
              <div className="panel-heading">
                <ShieldCheck size={18} />
                <h3>Agent decision</h3>
              </div>
              <p className="decision">{run.decision}</p>
              <p>{run.answer}</p>
            </article>
          </section>

          {pendingConsentIds.length > 0 && (
            <section className="panel consent-panel" aria-label="Permission requests">
              <div className="panel-heading">
                <SlidersHorizontal size={18} />
                <h3>Consent simulator</h3>
              </div>
              <div className="consent-list">
                {run.governanceDecisions
                  .filter((decision) => decision.decision === "requires_consent")
                  .map((decision) => (
                    <label className="consent-row" key={decision.dataItemId}>
                      <input
                        checked={consentState[decision.dataItemId] === true}
                        onChange={() => toggleConsent(decision.dataItemId)}
                        type="checkbox"
                      />
                      <span>
                        Allow minimized use of <strong>{decision.label}</strong> in{" "}
                        {layerMeta[decision.layer].description.toLowerCase()}
                      </span>
                    </label>
                  ))}
              </div>
            </section>
          )}

          <section className="content-grid lower-grid">
            <article className="panel">
              <div className="panel-heading">
                <Lock size={18} />
                <h3>Data-boundary decisions</h3>
              </div>
              <div className="decision-table">
                {run.governanceDecisions.map((decision) => (
                  <div className="decision-row" key={decision.dataItemId}>
                    <div>
                      <strong>{decision.label}</strong>
                      <span>{decision.releasedForm}</span>
                    </div>
                    <span className={`decision-pill ${decision.decision}`}>
                      {decisionLabel[decision.decision]}
                    </span>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel">
              <div className="panel-heading">
                <Network size={18} />
                <h3>Data-flow trace</h3>
              </div>
              <ol className="flow-list">
                {run.dataFlow.slice(0, 8).map((event) => (
                  <li key={`${event.step}-${event.actor}-${event.dataItemIds.join(".")}`}>
                    <span className="flow-step">{event.step}</span>
                    <div>
                      <strong>{event.actor}</strong>
                      <p>{event.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </article>
          </section>

          <section className="content-grid lower-grid">
            <article className="panel">
              <div className="panel-heading">
                <GitBranch size={18} />
                <h3>Tool-call trace</h3>
              </div>
              <div className="trace-list">
                {toolTrace.slice(0, 5).map((call) => (
                  <div className="trace-row" key={call.id}>
                    <div>
                      <strong>{call.toolName}</strong>
                      <span>{call.releaseForm} to {layerMeta[call.targetLayer].label}</span>
                    </div>
                    <span className={call.policyCompliant ? "trace-status pass" : "trace-status fail"}>
                      {call.status}
                    </span>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel">
              <div className="panel-heading">
                <ShieldCheck size={18} />
                <h3>Aggregate risk gate</h3>
              </div>
              <div className="trace-list">
                {aggregateProbes.map((probe) => (
                  <div className="trace-row" key={probe.id}>
                    <div>
                      <strong>{probe.dataItemId}</strong>
                      <span>risk {probe.reconstructionRiskScore}/100, k={probe.kAnonymityEstimate}</span>
                    </div>
                    <span className={`risk-decision ${probe.recommendedDecision}`}>
                      {probe.recommendedDecision.replaceAll("_", " ")}
                    </span>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="panel scorecard-panel">
            <div className="panel-heading">
              <CheckCircle2 size={18} />
              <h3>Evaluation scorecard</h3>
            </div>
            <div className="metric-grid">
              {evaluation.metrics.map((metric) => (
                <div className="metric" key={metric.id}>
                  <div className="metric-label">
                    <strong>{metric.label}</strong>
                    <span>{metric.score}</span>
                  </div>
                  <div className="meter" aria-hidden="true">
                    <span style={{ width: `${metric.score}%` }} />
                  </div>
                  <p>{metric.rationale}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="panel risk-panel">
            <div className="panel-heading">
              <AlertTriangle size={18} />
              <h3>Failure and risk notes</h3>
            </div>
            <ul>
              {run.riskNotes.slice(0, 6).map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </section>
        </section>
      </section>
    </main>
  );
}
