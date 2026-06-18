import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import { canarySeededItems } from "../src/harness/canary";
import { detectCanaryLeaks } from "../src/harness/leakDetector";
import { getScenarioById } from "../src/scenarios/library";

describe("canary leak detector", () => {
  const scenario = getScenarioById("data-rights-request");
  const canary = canarySeededItems(scenario)[0];

  it("detects identity, lowercase, stripped, URL, base64, and hex canary leaks", () => {
    const cases = [
      { payload: `ref ${canary.core}`, transform: "identity" },
      { payload: `ref ${canary.core.toUpperCase()}`, transform: "lowercase" },
      { payload: canary.core.split("").join("- "), transform: "stripped" },
      { payload: encodeURIComponent(`ref ${canary.core}`), transform: "url_decoded" },
      {
        payload: Buffer.from(`encoded ${canary.core}`, "utf8").toString("base64"),
        transform: "base64_decoded"
      },
      {
        payload: Buffer.from(`encoded ${canary.core}`, "utf8").toString("hex"),
        transform: "hex_decoded"
      },
      {
        payload: Buffer.from(canary.core, "utf8").toString("base64"),
        transform: "base64_core"
      },
      {
        payload: Buffer.from(canary.core, "utf8").toString("hex"),
        transform: "hex_core"
      }
    ];

    for (const entry of cases) {
      expect(detectCanaryLeaks(entry.payload, [canary]).map((match) => match.transform)).toContain(
        entry.transform
      );
    }
  });

  it("does not match a 23-character near miss", () => {
    expect(detectCanaryLeaks(canary.core.slice(0, 23), [canary])).toEqual([]);
  });

  it("does not produce false positives over a million canary-free corpus lines", () => {
    const totalLines = 1_000_000;
    const chunkSize = 1_000;

    for (let start = 0; start < totalLines; start += chunkSize) {
      const payload = Array.from({ length: chunkSize }, (_, offset) => {
        const line = start + offset;
        return `scenario text ${line} local boundary consent aggregate private review`;
      }).join("\n");

      expect(detectCanaryLeaks(payload, [canary])).toEqual([]);
    }
  });
});
