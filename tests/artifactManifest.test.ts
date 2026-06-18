import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildArtifactManifest, verifyArtifactManifest } from "../src/evals/artifactManifest";

const root = resolve(__dirname, "..");

describe("artifact manifest", () => {
  it("hashes public benchmark artifacts for reproducibility review", async () => {
    const manifest = await buildArtifactManifest(root);

    expect(manifest.artifactCount).toBeGreaterThan(80);
    expect(manifest.entries.some((entry) => entry.path === "README.md")).toBe(true);
    expect(manifest.entries.some((entry) => entry.path === "outputs/sample_run_log.json")).toBe(
      true
    );
    expect(manifest.entries.some((entry) => entry.path.endsWith(".DS_Store"))).toBe(false);
    expect(manifest.entries.every((entry) => /^[a-f0-9]{64}$/.test(entry.sha256))).toBe(true);
  });

  it("verifies the checked-in manifest after regeneration", async () => {
    expect(await verifyArtifactManifest(root)).toEqual([]);
  });
});
