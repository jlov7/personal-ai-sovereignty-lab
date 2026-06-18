import { describe, expect, it } from "vitest";
import { renderLeakDemo } from "../src/evals/demoLeakCli";

describe("leak demo", () => {
  it("prints a readable egress-tap failure for the malicious fixture", async () => {
    const output = await renderLeakDemo();

    expect(output).toContain("PAISL canary leak demo");
    expect(output).toContain("Scenario: data-rights-request");
    expect(output).toContain("CANARY_LEAK_CAUGHT");
    expect(output).toContain("FAIL: disallowed canary leak caught at the egress tap.");
    expect(output).toContain("score.slr=1");
  });
});
