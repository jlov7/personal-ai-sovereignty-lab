import type { Scenario } from "../shared/types";

const stopwords = new Set([
  "a",
  "and",
  "are",
  "as",
  "by",
  "for",
  "from",
  "in",
  "is",
  "of",
  "on",
  "or",
  "that",
  "the",
  "to",
  "with",
  "without"
]);

export function scenarioText(scenario: Scenario): string {
  return [
    scenario.title,
    scenario.domain,
    scenario.summary,
    scenario.task,
    scenario.userObjective,
    scenario.requestedAutonomy,
    scenario.architectureLayerFocus.join(" "),
    ...scenario.dataItems.flatMap((item) => [
      item.label,
      item.description,
      item.sensitivity,
      item.subject,
      item.defaultBoundary,
      item.allowedLayers.join(" "),
      item.purpose
    ]),
    ...scenario.expectedOutputs,
    ...scenario.riskTriggers,
    ...scenario.successCriteria,
    ...scenario.failureModes
  ].join(" ");
}

export function normalizedTokens(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 2 && !stopwords.has(token));

  return new Set(tokens);
}

export interface ScenarioTokenEntry {
  scenarioId: string;
  tokens: Set<string>;
}

export function scenarioTokenEntry(scenario: Scenario): ScenarioTokenEntry {
  return {
    scenarioId: scenario.id,
    tokens: normalizedTokens(scenarioText(scenario))
  };
}

export function jaccardSimilarity(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 && right.size === 0) {
    return 1;
  }

  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) {
      intersection += 1;
    }
  }

  const union = left.size + right.size - intersection;
  return intersection / Math.max(1, union);
}

export function maxScenarioSimilarity(candidate: Scenario, existing: readonly Scenario[]): number {
  const candidateTokens = normalizedTokens(scenarioText(candidate));
  return maxTokenSimilarity(candidateTokens, existing.map(scenarioTokenEntry));
}

export function maxTokenSimilarity(
  candidateTokens: Set<string>,
  existing: readonly ScenarioTokenEntry[]
): number {
  return existing.reduce((max, scenario) => {
    const similarity = jaccardSimilarity(candidateTokens, scenario.tokens);
    return Math.max(max, similarity);
  }, 0);
}

export function isNearDuplicate(
  candidate: Scenario,
  existing: readonly Scenario[],
  threshold: number
): boolean {
  return maxScenarioSimilarity(candidate, existing) > threshold;
}
