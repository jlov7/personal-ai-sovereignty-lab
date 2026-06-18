import { describe, expect, it } from "vitest";
import { buildHarnessRuns } from "../src/evals/harnessReport";
import {
  createSubmittedHarnessSweep,
  verifySubmittedHarnessSweep
} from "../src/evals/submittedHarnessSweep";
import type { HarnessRunRecord } from "../src/harness/types";
import { scenarios } from "../src/scenarios/library";

describe("submitted harness sweep verification", () => {
  async function fixtureRun(): Promise<HarnessRunRecord> {
    return (await buildHarnessRuns(scenarios.slice(0, 1)))[0];
  }

  it("accepts a digest-bound sweep whose leak findings reproduce locally", async () => {
    const run = await fixtureRun();
    const sweep = createSubmittedHarnessSweep([run]);

    expect(verifySubmittedHarnessSweep(sweep, scenarios)).toEqual({
      passed: true,
      checkedRunCount: 1,
      failures: []
    });
  });

  it("rejects a tampered transcript by digest mismatch", async () => {
    const run = await fixtureRun();
    const sweep = createSubmittedHarnessSweep([run]);
    sweep.records[0] = { ...sweep.records[0], finalAnswer: "tampered" };

    const result = verifySubmittedHarnessSweep(sweep, scenarios);

    expect(result.passed).toBe(false);
    expect(result.failures).toContain(`digest mismatch for ${run.runId}`);
  });

  it("rejects claimed leak findings the local detector cannot reproduce", async () => {
    const run = await fixtureRun();
    const tamperedRun = {
      ...run,
      leakFindings: [
        {
          scenarioId: run.scenarioId,
          tool: "send_external" as const,
          layer: "federated" as const,
          turn: 0,
          dataItemId: "nonexistent",
          transform: "identity" as const,
          offset: 0,
          payloadExcerpt: "fake",
          disallowed: true,
          reason: "fake leak"
        }
      ]
    };
    const sweep = createSubmittedHarnessSweep([tamperedRun]);

    const result = verifySubmittedHarnessSweep(sweep, scenarios);

    expect(result.passed).toBe(false);
    expect(result.failures).toContain(`leak findings do not reproduce for ${run.runId}`);
  });
});
