import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import type {
  SubmittedArtifactRunnerReport,
  SubmissionReceipt
} from "./submittedArtifactRunnerReport";

export type BundleVerificationStatus = "pass" | "fail";

export interface ArtifactBundleManifest {
  schemaVersion: "paisl-artifact-bundle/v1";
  artifactId: string;
  bundleVersion: string;
  createdAt: string;
  submitter: {
    name: string;
    independence: "author_seed" | "independent_external" | "vendor_self_report";
  };
  system: {
    name: string;
    version: string;
    type:
      | "deterministic_reference"
      | "local_model"
      | "cloud_model"
      | "tool_using_agent"
      | "production_personal_agent"
      | "negative_control";
  };
  runtime: {
    engine: "node";
    engineVersion: string;
    packageManager: "none" | { name: string; version: string };
    network: "none" | "loopback_only" | "declared_external";
    filesystem: "read_only_bundle_with_writable_tmp";
    timeoutMs: number;
    resourceLimits: {
      memoryMb: number;
      pids: number;
    };
    runtimeDigest: string;
  };
  entrypoint: {
    path: string;
    command: "node";
    args: string[];
  };
  sourceDigests: Array<{
    path: string;
    sha256: string;
    bytes: number;
    role: "entrypoint" | "supporting_file" | "lockfile";
  }>;
  scenarioCoverage: Array<{
    scenarioId: string;
    expectedTraceId: string;
    expectedBoundaryDecisions: Array<
      "local_only" | "requires_consent" | "safe_aggregated_output" | "blocked_due_to_privacy_risk"
    >;
    consentProfile: string;
  }>;
  expectedOutputs: Array<{
    kind: "external_agent_trace" | "scorecard" | "markdown_report";
    location: string;
    traceId?: string;
  }>;
  allowedWritePaths: string[];
  claimBoundaries: string[];
  limitations: string[];
}

interface BundleFixtureIndex {
  schemaVersion: "paisl-artifact-bundle-fixture-index/v1";
  fixtures: Array<{
    bundleDir: string;
    expectedStatus: BundleVerificationStatus;
    reason: string;
  }>;
}

export interface ArtifactBundleCheck {
  id: string;
  passed: boolean;
  evidence: string;
}

export interface ArtifactBundleVerification {
  artifactId: string;
  bundleDir: string;
  manifestPath: string;
  manifestSha256: string | null;
  verificationStatus: BundleVerificationStatus;
  expectedStatus: BundleVerificationStatus | null;
  expectationMatched: boolean | null;
  checks: ArtifactBundleCheck[];
  sourcePaths: string[];
  limitations: string[];
}

export interface ArtifactBundleVerificationReport {
  benchmark: "personal-ai-sovereignty-benchmark";
  version: "0.18.0-artifact-bundle-standard";
  generatedAt: string;
  status: "passed" | "failed";
  sourcePaths: string[];
  bundleCount: number;
  passedBundleCount: number;
  rejectedBundleCount: number;
  expectedFailureCount: number;
  expectationMatchCount: number;
  bundles: ArtifactBundleVerification[];
  limitations: string[];
}

export interface ArtifactTransparencyLedgerEntry {
  index: number;
  artifactId: string;
  receiptId: string;
  previousHash: string;
  receiptHash: string;
  bundleManifestHash: string | null;
  bundleVerificationStatus: BundleVerificationStatus | "missing";
  entryHash: string;
}

export interface ArtifactTransparencyLedgerReport {
  benchmark: "personal-ai-sovereignty-benchmark";
  version: "0.18.0-artifact-transparency-ledger";
  generatedAt: string;
  ledgerId: "paisl-submitted-artifact-ledger-v1";
  algorithm: "sha256-json-stable-sort-v1";
  entryCount: number;
  chainHead: string;
  entries: ArtifactTransparencyLedgerEntry[];
  integrity: {
    valid: boolean;
    failures: string[];
  };
  tamperProbe: {
    originalValid: boolean;
    tamperedValid: boolean;
    detected: boolean;
    tamperedField: "receiptHash";
  };
  limitations: string[];
}

const GENERATED_AT = new Date("2026-05-23T00:00:00.000Z").toISOString();
const ZERO_HASH = "0".repeat(64);
const RUNTIME_DIGEST_PREFIX = "sha256:";

function sortForHash(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortForHash);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, sortForHash(entry)])
    );
  }
  return value;
}

function canonical(value: unknown): string {
  return JSON.stringify(sortForHash(value));
}

function sha256(contents: string | Buffer): string {
  return createHash("sha256").update(contents).digest("hex");
}

function check(id: string, passed: boolean, evidence: string): ArtifactBundleCheck {
  return { id, passed, evidence };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isExactSemver(value: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(value);
}

function runtimeDigest(runtime: ArtifactBundleManifest["runtime"]): string {
  const { runtimeDigest: _runtimeDigest, ...digestInput } = runtime;
  return `${RUNTIME_DIGEST_PREFIX}${sha256(canonical(digestInput))}`;
}

function parseManifest(raw: string): ArtifactBundleManifest | null {
  const parsed = JSON.parse(raw) as unknown;
  return isRecord(parsed) ? (parsed as unknown as ArtifactBundleManifest) : null;
}

async function listRelativeFiles(baseDir: string): Promise<string[]> {
  async function walk(current: string): Promise<string[]> {
    const entries = await readdir(current, { withFileTypes: true });
    const nested = await Promise.all(
      entries.map(async (entry) => {
        const absolute = join(current, entry.name);
        if (entry.isDirectory()) {
          return walk(absolute);
        }
        return [relative(baseDir, absolute)];
      })
    );
    return nested.flat();
  }

  return (await walk(baseDir)).sort();
}

function pathIsDeclared(path: string, declared: string[]): boolean {
  return declared.some((candidate) => path === candidate || path.startsWith(`${candidate}/`));
}

// A bundle-declared path is only safe if it is relative and stays inside the
// bundle directory. Absolute paths or any `..` segment could point the runner
// at host files outside the sandboxed copy, so they are rejected.
function isContainedRelPath(path: unknown): boolean {
  if (typeof path !== "string" || path.length === 0 || isAbsolute(path)) {
    return false;
  }
  return !path.replace(/\\/g, "/").split("/").includes("..");
}

// Executing a submitted entrypoint runs untrusted third-party code as a host
// Node process. It is OFF by default so `pnpm artifact:bundles` is safe to run
// on any submission; set PAISL_EXECUTE_BUNDLES=1 to opt in on an isolated host.
const EXECUTE_BUNDLES_BY_DEFAULT = process.env.PAISL_EXECUTE_BUNDLES === "1";

async function executeEntrypointInCopy(
  bundleDir: string,
  manifest: ArtifactBundleManifest
): Promise<{ exitCode: number | null; unexpectedWrites: string[]; stdout: string }> {
  const tempRoot = await mkdtemp(join(tmpdir(), "paisl-artifact-bundle-"));
  const copiedDir = resolve(tempRoot, basename(bundleDir));
  await cp(bundleDir, copiedDir, { recursive: true });
  const before = new Set(await listRelativeFiles(copiedDir));
  const entrypointPath = resolve(copiedDir, manifest.entrypoint.path);

  try {
    const run = await new Promise<{ exitCode: number | null; stdout: string }>((resolveRun) => {
      const child = spawn(process.execPath, [entrypointPath, ...manifest.entrypoint.args], {
        cwd: dirname(entrypointPath),
        env: {
          PATH: process.env.PATH ?? "",
          PAISL_ARTIFACT_BUNDLE_ID: manifest.artifactId
        },
        stdio: ["ignore", "pipe", "pipe"]
      });
      const stdoutChunks: Buffer[] = [];
      let settled = false;
      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
      }, manifest.runtime.timeoutMs);
      const finish = (exitCode: number | null) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeout);
        resolveRun({ exitCode, stdout: Buffer.concat(stdoutChunks).toString("utf8") });
      };
      child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
      child.stderr.resume();
      child.on("error", () => finish(null));
      child.on("close", (code) => finish(code));
    });
    const after = await listRelativeFiles(copiedDir);
    const unexpectedWrites = after.filter(
      (filePath) => !before.has(filePath) && !pathIsDeclared(filePath, manifest.allowedWritePaths)
    );
    return { exitCode: run.exitCode, unexpectedWrites, stdout: run.stdout };
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

function parseLastJsonLine(stdout: string): Record<string, unknown> | null {
  const lastLine = stdout
    .trim()
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .at(-1);
  if (!lastLine) {
    return null;
  }
  try {
    const parsed = JSON.parse(lastLine) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function readFixtureIndex(root: string): Promise<BundleFixtureIndex> {
  const indexPath = resolve(root, "examples/artifact_bundles/fixture_index.json");
  return JSON.parse(await readFile(indexPath, "utf8")) as BundleFixtureIndex;
}

export async function verifyArtifactBundleDirectory(
  root: string,
  bundleDir: string,
  expectedStatus: BundleVerificationStatus | null = null,
  executeEntrypoints: boolean = EXECUTE_BUNDLES_BY_DEFAULT
): Promise<ArtifactBundleVerification> {
  const absoluteBundleDir = resolve(root, bundleDir);
  const manifestPath = resolve(absoluteBundleDir, "bundle.json");
  const relativeBundleDir = relative(root, absoluteBundleDir) || absoluteBundleDir;
  const relativeManifestPath = relative(root, manifestPath) || manifestPath;
  const sourcePaths = [relativeManifestPath];
  const checks: ArtifactBundleCheck[] = [];
  let manifestSha256: string | null = null;
  let manifest: ArtifactBundleManifest | null = null;
  let artifactId = basename(absoluteBundleDir);

  try {
    const rawManifest = await readFile(manifestPath, "utf8");
    manifestSha256 = sha256(rawManifest);
    manifest = parseManifest(rawManifest);
    artifactId = manifest?.artifactId ?? artifactId;
    checks.push(check("manifest-json-parse", manifest !== null, `Parsed ${relativeManifestPath}.`));
  } catch (error) {
    checks.push(
      check(
        "manifest-json-parse",
        false,
        error instanceof Error ? error.message : `Could not parse ${relativeManifestPath}.`
      )
    );
  }

  if (manifest) {
    const requiredPresent =
      manifest.schemaVersion === "paisl-artifact-bundle/v1" &&
      Boolean(manifest.artifactId) &&
      Boolean(manifest.bundleVersion) &&
      Boolean(manifest.createdAt) &&
      isRecord(manifest.submitter) &&
      isRecord(manifest.system) &&
      isRecord(manifest.runtime) &&
      isRecord(manifest.entrypoint);
    checks.push(check("required-manifest-fields", requiredPresent, "Required manifest objects are present."));

    const claimBoundariesPresent = Array.isArray(manifest.claimBoundaries) && manifest.claimBoundaries.length >= 2;
    checks.push(
      check(
        "claim-boundaries-present",
        claimBoundariesPresent,
        `${manifest.claimBoundaries?.length ?? 0} claim boundaries declared.`
      )
    );

    const exactRuntime =
      isExactSemver(manifest.runtime.engineVersion) &&
      manifest.runtime.packageManager === "none" &&
      manifest.runtime.timeoutMs > 0 &&
      manifest.runtime.resourceLimits.memoryMb > 0 &&
      manifest.runtime.resourceLimits.pids > 0 &&
      manifest.runtime.runtimeDigest === runtimeDigest(manifest.runtime);
    checks.push(
      check(
        "runtime-pinned",
        exactRuntime,
        `engine=${manifest.runtime.engine}@${manifest.runtime.engineVersion}; digest=${manifest.runtime.runtimeDigest}`
      )
    );

    const declaredPaths = [
      manifest.entrypoint.path,
      ...(Array.isArray(manifest.allowedWritePaths) ? manifest.allowedWritePaths : []),
      ...(Array.isArray(manifest.sourceDigests) ? manifest.sourceDigests.map((digest) => digest.path) : []),
      ...(Array.isArray(manifest.expectedOutputs)
        ? manifest.expectedOutputs.map((output) => output.location)
        : [])
    ];
    const pathsContained = declaredPaths.every(isContainedRelPath);
    checks.push(
      check(
        "manifest-paths-contained",
        pathsContained,
        pathsContained
          ? "All declared paths are relative and stay inside the bundle."
          : "A declared path is absolute or escapes the bundle directory."
      )
    );

    const entrypointPath = pathsContained ? resolve(absoluteBundleDir, manifest.entrypoint.path) : null;
    const entrypointExists = entrypointPath !== null && existsSync(entrypointPath);
    checks.push(check("entrypoint-exists", entrypointExists, manifest.entrypoint.path));
    if (entrypointPath !== null) {
      sourcePaths.push(relative(root, entrypointPath) || entrypointPath);
    }

    const entrypointCovered = manifest.sourceDigests.some((digest) => digest.path === manifest.entrypoint.path);
    checks.push(
      check("source-digests-cover-entrypoint", entrypointCovered, `${manifest.sourceDigests.length} source digests.`)
    );

    for (const declaredDigest of pathsContained ? manifest.sourceDigests : []) {
      const sourcePath = resolve(absoluteBundleDir, declaredDigest.path);
      sourcePaths.push(relative(root, sourcePath) || sourcePath);
      if (!existsSync(sourcePath)) {
        checks.push(check(`source-digest:${declaredDigest.path}`, false, "Source file is missing."));
        continue;
      }
      const contents = await readFile(sourcePath);
      const actualSha = sha256(contents);
      const passed = actualSha === declaredDigest.sha256 && contents.byteLength === declaredDigest.bytes;
      checks.push(
        check(
          `source-digest:${declaredDigest.path}`,
          passed,
          `expected=${declaredDigest.sha256}/${declaredDigest.bytes}; actual=${actualSha}/${contents.byteLength}`
        )
      );
    }

    const scenarioCoverageDeclared =
      Array.isArray(manifest.scenarioCoverage) &&
      manifest.scenarioCoverage.length > 0 &&
      manifest.scenarioCoverage.every(
        (coverage) =>
          Boolean(coverage.scenarioId) &&
          Boolean(coverage.expectedTraceId) &&
          Array.isArray(coverage.expectedBoundaryDecisions) &&
          coverage.expectedBoundaryDecisions.length > 0
      );
    checks.push(
      check(
        "scenario-coverage-declared",
        scenarioCoverageDeclared,
        `${manifest.scenarioCoverage?.length ?? 0} scenario coverage entries.`
      )
    );

    const outputsDeclared =
      Array.isArray(manifest.expectedOutputs) &&
      manifest.expectedOutputs.length > 0 &&
      manifest.expectedOutputs.every((output) => Boolean(output.kind) && Boolean(output.location));
    checks.push(
      check("expected-outputs-declared", outputsDeclared, `${manifest.expectedOutputs?.length ?? 0} outputs.`)
    );

    if (entrypointExists && executeEntrypoints && pathsContained) {
      const execution = await executeEntrypointInCopy(absoluteBundleDir, manifest);
      checks.push(
        check("entrypoint-execution", execution.exitCode === 0, `exitCode=${execution.exitCode ?? "null"}`)
      );
      const emitted = parseLastJsonLine(execution.stdout);
      const expectedTraceIds = new Set(manifest.expectedOutputs.map((output) => output.traceId).filter(Boolean));
      const traceId = typeof emitted?.traceId === "string" ? emitted.traceId : null;
      checks.push(
        check(
          "expected-output-trace",
          traceId !== null && expectedTraceIds.has(traceId),
          `emitted=${traceId ?? "none"}`
        )
      );
      checks.push(
        check(
          "unexpected-writes",
          execution.unexpectedWrites.length === 0,
          execution.unexpectedWrites.length === 0
            ? "No undeclared writes observed in temp execution copy."
            : `Undeclared writes: ${execution.unexpectedWrites.join(", ")}`
        )
      );
    } else if (entrypointExists) {
      checks.push(
        check(
          "entrypoint-execution-skipped",
          true,
          executeEntrypoints
            ? "Execution skipped: manifest declares an uncontained path."
            : "Execution disabled by default (untrusted code). Set PAISL_EXECUTE_BUNDLES=1 on an isolated host to run it."
        )
      );
    }
  }

  const verificationStatus = checks.every((result) => result.passed) ? "pass" : "fail";
  const expectationMatched = expectedStatus === null ? null : verificationStatus === expectedStatus;

  return {
    artifactId,
    bundleDir: relativeBundleDir,
    manifestPath: relativeManifestPath,
    manifestSha256,
    verificationStatus,
    expectedStatus,
    expectationMatched,
    checks,
    sourcePaths: [...new Set(sourcePaths)].sort(),
    limitations: [
      "The bundle verifier checks packaging integrity and manifest honesty, not hidden model reasoning.",
      executeEntrypoints
        ? "Opt-in unexpected-write detection runs the fixture in a temporary copy; production isolation still requires a real sandbox."
        : "Default verification does not execute entrypoints; unexpected-write detection requires PAISL_EXECUTE_BUNDLES=1 on an isolated host.",
      "Passing bundle verification means the artifact is reproducible and reviewable, not that the agent behavior is safe."
    ]
  };
}

export async function buildArtifactBundleVerificationReport(
  root: string,
  options: { executeEntrypoints?: boolean } = {}
): Promise<ArtifactBundleVerificationReport> {
  const executeEntrypoints = options.executeEntrypoints ?? EXECUTE_BUNDLES_BY_DEFAULT;
  const fixtureIndex = await readFixtureIndex(root);
  const verifications = await Promise.all(
    fixtureIndex.fixtures.map((fixture) =>
      verifyArtifactBundleDirectory(root, fixture.bundleDir, fixture.expectedStatus, executeEntrypoints)
    )
  );
  const sourcePaths = [
    "examples/artifact_bundles/fixture_index.json",
    ...verifications.flatMap((verification) => verification.sourcePaths)
  ];
  const expectationMatchCount = verifications.filter(
    (verification) => verification.expectationMatched === true
  ).length;
  const passedBundleCount = verifications.filter(
    (verification) => verification.verificationStatus === "pass"
  ).length;
  const rejectedBundleCount = verifications.filter(
    (verification) => verification.verificationStatus === "fail"
  ).length;
  const expectedFailureCount = fixtureIndex.fixtures.filter(
    (fixture) => fixture.expectedStatus === "fail"
  ).length;

  return {
    benchmark: "personal-ai-sovereignty-benchmark",
    version: "0.18.0-artifact-bundle-standard",
    generatedAt: GENERATED_AT,
    status: expectationMatchCount === verifications.length ? "passed" : "failed",
    sourcePaths: [...new Set(sourcePaths)].sort(),
    bundleCount: verifications.length,
    passedBundleCount,
    rejectedBundleCount,
    expectedFailureCount,
    expectationMatchCount,
    bundles: verifications.sort((a, b) => a.artifactId.localeCompare(b.artifactId)),
    limitations: [
      "Seed bundles exercise the standard but are not independent external submissions.",
      "The malformed bundle is intentionally included so verifier rejection remains visible and testable.",
      "Bundle verification is an intake gate; broker, sandbox, scoring, and human review remain separate gates."
    ]
  };
}

function receiptHash(receipt: SubmissionReceipt): string {
  return sha256(canonical(receipt));
}

function ledgerEntryHash(entry: Omit<ArtifactTransparencyLedgerEntry, "entryHash">): string {
  return sha256(canonical(entry));
}

function verifyLedgerEntries(entries: ArtifactTransparencyLedgerEntry[]): { valid: boolean; failures: string[] } {
  const failures: string[] = [];
  let previousHash = ZERO_HASH;

  entries.forEach((entry, index) => {
    if (entry.index !== index) {
      failures.push(`entry ${index} has mismatched index ${entry.index}`);
    }
    if (entry.previousHash !== previousHash) {
      failures.push(`entry ${index} previous hash mismatch`);
    }
    const { entryHash: _entryHash, ...unsignedEntry } = entry;
    const expectedHash = ledgerEntryHash(unsignedEntry);
    if (entry.entryHash !== expectedHash) {
      failures.push(`entry ${index} hash mismatch`);
    }
    previousHash = entry.entryHash;
  });

  return { valid: failures.length === 0, failures };
}

export function buildArtifactTransparencyLedgerReport(
  bundleReport: ArtifactBundleVerificationReport,
  runnerReport: SubmittedArtifactRunnerReport
): ArtifactTransparencyLedgerReport {
  const bundlesByArtifactId = new Map(bundleReport.bundles.map((bundle) => [bundle.artifactId, bundle]));
  let previousHash = ZERO_HASH;
  const entries = runnerReport.receipts.map((receipt, index) => {
    const bundle = bundlesByArtifactId.get(receipt.artifactId);
    const unsignedEntry = {
      index,
      artifactId: receipt.artifactId,
      receiptId: receipt.receiptId,
      previousHash,
      receiptHash: receiptHash(receipt),
      bundleManifestHash: bundle?.manifestSha256 ?? null,
      bundleVerificationStatus: bundle?.verificationStatus ?? ("missing" as const)
    };
    const entryHash = ledgerEntryHash(unsignedEntry);
    previousHash = entryHash;
    return { ...unsignedEntry, entryHash };
  });
  const integrity = verifyLedgerEntries(entries);
  const tamperedEntries =
    entries.length === 0
      ? entries
      : entries.map((entry, index) =>
          index === 0
            ? {
                ...entry,
                receiptHash: `${entry.receiptHash[0] === "0" ? "1" : "0"}${entry.receiptHash.slice(1)}`
              }
            : entry
        );
  const tamperedIntegrity = verifyLedgerEntries(tamperedEntries);

  return {
    benchmark: "personal-ai-sovereignty-benchmark",
    version: "0.18.0-artifact-transparency-ledger",
    generatedAt: GENERATED_AT,
    ledgerId: "paisl-submitted-artifact-ledger-v1",
    algorithm: "sha256-json-stable-sort-v1",
    entryCount: entries.length,
    chainHead: entries.at(-1)?.entryHash ?? ZERO_HASH,
    entries,
    integrity,
    tamperProbe: {
      originalValid: integrity.valid,
      tamperedValid: tamperedIntegrity.valid,
      detected: integrity.valid && !tamperedIntegrity.valid,
      tamperedField: "receiptHash"
    },
    limitations: [
      "The transparency ledger is deterministic fixture evidence, not a public append-only service.",
      "Fixture receipts use public HMAC keys for reproducibility and are not identity-bound.",
      "A production ledger would need independent hosting, monotonic append guarantees, reviewer identity, and revocation handling."
    ]
  };
}

export function renderArtifactBundleVerificationMarkdown(report: ArtifactBundleVerificationReport): string {
  const executedBundleCount = report.bundles.filter((bundle) =>
    bundle.checks.some((checkResult) => checkResult.id === "entrypoint-execution")
  ).length;
  const executionSummary =
    executedBundleCount > 0
      ? `Entrypoint execution ran for ${executedBundleCount}/${report.bundleCount} bundle(s), so unexpected-write checks apply only to those executed copies.`
      : "Entrypoint execution is disabled in the default verifier run, so this report proves static packaging integrity and path containment, not runtime side effects.";
  const rows = report.bundles
    .map(
      (bundle) =>
        `| ${bundle.artifactId} | ${bundle.verificationStatus} | ${bundle.expectedStatus ?? "n/a"} | ${
          bundle.expectationMatched === null ? "n/a" : bundle.expectationMatched ? "yes" : "no"
        } | ${bundle.checks.filter((checkResult) => checkResult.passed).length}/${bundle.checks.length} |`
    )
    .join("\n");
  const failures = report.bundles
    .flatMap((bundle) =>
      bundle.checks
        .filter((checkResult) => !checkResult.passed)
        .map((checkResult) => `- ${bundle.artifactId}: ${checkResult.id} - ${checkResult.evidence}`)
    )
    .join("\n");

  return `# Artifact Bundle Verification Report

Generated by \`pnpm artifact:bundles\`.

## Summary

- Status: \`${report.status}\`
- Bundle count: ${report.bundleCount}
- Passed bundles: ${report.passedBundleCount}
- Rejected bundles: ${report.rejectedBundleCount}
- Expected malformed fixtures: ${report.expectedFailureCount}
- Expectation matches: ${report.expectationMatchCount}/${report.bundleCount}

## Bundles

| Artifact | Verification | Expected | Matched | Checks |
| --- | --- | --- | --- | ---: |
${rows}

## Rejection Evidence

${failures.length > 0 ? failures : "- No rejected checks."}

## Interpretation

The bundle verifier is an intake gate. It proves that a submission is reproducible, digest-bound, explicit about runtime constraints, explicit about scenario coverage, and constrained to bundle-local declared paths. ${executionSummary} It does not prove the agent is safe; unsafe-but-well-packaged bundles still need broker, scorer, and review gates.

## Limitations

${report.limitations.map((limitation) => `- ${limitation}`).join("\n")}
`;
}

export function renderArtifactTransparencyLedgerMarkdown(report: ArtifactTransparencyLedgerReport): string {
  const rows = report.entries
    .map(
      (entry) =>
        `| ${entry.index} | ${entry.artifactId} | ${entry.receiptId} | \`${entry.previousHash.slice(
          0,
          12
        )}\` | \`${entry.entryHash.slice(0, 12)}\` | ${entry.bundleVerificationStatus} |`
    )
    .join("\n");

  return `# Artifact Transparency Ledger Report

Generated by \`pnpm artifact:bundles\`.

## Summary

- Ledger ID: \`${report.ledgerId}\`
- Entry count: ${report.entryCount}
- Chain head: \`${report.chainHead}\`
- Integrity valid: ${report.integrity.valid}
- Tamper probe detected altered receipt hash: ${report.tamperProbe.detected}

## Entries

| Index | Artifact | Receipt | Previous | Entry Hash | Bundle Verification |
| ---: | --- | --- | --- | --- | --- |
${rows}

## Integrity

- Original valid: ${report.tamperProbe.originalValid}
- Tampered valid: ${report.tamperProbe.tamperedValid}
- Tampered field: \`${report.tamperProbe.tamperedField}\`

## Limitations

${report.limitations.map((limitation) => `- ${limitation}`).join("\n")}
`;
}
