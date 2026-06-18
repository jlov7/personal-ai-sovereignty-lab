import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");
const coreDir = resolve(root, "src/core");

function tsFiles(dir: string): string[] {
  return readdirSync(dir)
    .flatMap((entry) => {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        return tsFiles(path);
      }
      return path.endsWith(".ts") ? [path] : [];
    })
    .sort();
}

describe("core evaluator isolation", () => {
  it("keeps src/core imports inside src/core or Node builtins", () => {
    for (const file of tsFiles(coreDir)) {
      const source = readFileSync(file, "utf8");
      const importSpecifiers = [...source.matchAll(/\bfrom\s+["']([^"']+)["']/g)].map(
        (match) => match[1]
      );

      for (const specifier of importSpecifiers) {
        const isCoreRelative = specifier.startsWith("./");
        const isNodeBuiltin = specifier.startsWith("node:");
        expect(
          isCoreRelative || isNodeBuiltin,
          `${relative(root, file)} imports ${specifier}; core files may not import outside src/core.`
        ).toBe(true);
      }
    }
  });
});
