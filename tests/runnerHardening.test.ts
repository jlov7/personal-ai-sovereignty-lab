import { describe, expect, it } from "vitest";
import {
  buildRunnerHardeningReport,
  loadRunnerEscapeCorpus,
  runnerDockerProfileContract
} from "../src/evals/runnerHardeningReport";

describe("runner hardening report", () => {
  it("defines an explicit Docker profile contract across the requested control categories", () => {
    const contract = runnerDockerProfileContract();
    const categories = new Set(contract.controls.map((control) => control.category));

    expect(contract.args).toContain("--network none");
    expect(contract.args).toContain("--read-only");
    expect(contract.args).toContain("--security-opt no-new-privileges");
    expect(contract.args).toContain("--pids-limit 64");
    expect(contract.args).toContain("--memory 256m");
    expect(categories).toEqual(
      new Set(["network", "filesystem", "environment", "process", "package_install", "ipc", "resource"])
    );
    expect(contract.seccompAppArmor.status).toBe("documented_not_enforced_by_fixture");
  });

  it("loads a runner escape corpus with mapped probes and limitation labels", async () => {
    const corpus = await loadRunnerEscapeCorpus(process.cwd());

    expect(corpus.cases).toHaveLength(7);
    expect(corpus.cases.every((testCase) => testCase.mappedProbeId.length > 0)).toBe(true);
    expect(corpus.cases.every((testCase) => testCase.limitation.length > 0)).toBe(true);
    expect(new Set(corpus.cases.map((testCase) => testCase.category))).toEqual(
      new Set(["network", "filesystem", "environment", "process", "package_install", "ipc", "resource"])
    );
  });

  it("keeps static runner-hardening checks deterministic when Docker probes are skipped", async () => {
    const report = await buildRunnerHardeningReport(process.cwd(), {
      runDockerProfile: false
    });

    expect(report.status).toBe("skipped");
    expect(report.probeCount).toBe(0);
    expect(report.escapeCorpusCount).toBe(7);
    expect(report.staticPolicyChecks.every((check) => check.passed)).toBe(true);
    expect(report.limitations.join(" ")).toContain("not a production multi-tenant sandbox");
  });
});
