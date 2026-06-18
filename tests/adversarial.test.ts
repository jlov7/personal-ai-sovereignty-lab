import { describe, expect, it } from "vitest";
import { runAdversarialSuite } from "../src/evals/adversarial";

describe("adversarial containment checks", () => {
  it("passes every explicit overreach containment case", () => {
    const results = runAdversarialSuite();

    expect(results.length).toBeGreaterThanOrEqual(6);
    expect(results.every((result) => result.passed)).toBe(true);
  });
});
