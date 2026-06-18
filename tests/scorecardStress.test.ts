import { describe, expect, it } from "vitest";
import { runAgent } from "../src/agent/runAgent";
import { compareBaselines } from "../src/evals/baselines";
import { evaluateRun } from "../src/evals/scorer";
import { buildScorecardStressReport } from "../src/evals/scorecardStressReport";
import { scenarios } from "../src/scenarios/library";

describe("scorecard stress report", () => {
  it("checks that author-defined scoring separates unsafe and over-restrictive baselines", () => {
    const results = scenarios.map((scenario) => evaluateRun(runAgent(scenario)));
    const report = buildScorecardStressReport(results, compareBaselines());
    const byId = new Map(report.checks.map((check) => [check.id, check]));

    expect(report.scenarioCount).toBe(scenarios.length);
    expect(byId.get("centralized-negative-control-gap")?.result).toBe("pass");
    expect(byId.get("centralized-privacy-floor")?.result).toBe("pass");
    expect(byId.get("centralized-user-control-floor")?.result).toBe("pass");
    expect(byId.get("local-only-usefulness-penalty")?.result).not.toBe("fail");
    expect(report.limitations.join(" ")).toContain("not independent measurement validation");
  });
});
