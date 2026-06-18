import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");
const harnessDir = resolve(root, "src/harness");

function tsFiles(dir: string): string[] {
  return readdirSync(dir)
    .flatMap((entry) => {
      const path = join(dir, entry);
      return statSync(path).isDirectory() ? tsFiles(path) : path.endsWith(".ts") ? [path] : [];
    })
    .sort();
}

describe("harness egress chokepoint", () => {
  it("keeps egress payload recording behind EgressTap", () => {
    const writesOutsideTap = tsFiles(harnessDir)
      .filter((path) => !path.endsWith("egressTap.ts"))
      .filter((path) => readFileSync(path, "utf8").includes(".records.push"));

    expect(writesOutsideTap).toEqual([]);

    const tools = readFileSync(resolve(harnessDir, "tools.ts"), "utf8");
    for (const tool of ["send_external", "post_private_compute", "publish_aggregate", "finish"]) {
      expect(tools).toContain(`case "${tool}"`);
    }
    expect(tools.match(/runtime\.tap\.record/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
