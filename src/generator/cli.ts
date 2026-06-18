import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { curatedScenarios } from "../scenarios/library";
import { generateScenarios, renderScenarioModule } from "./scenarioGenerator";

interface CliArgs {
  seed: number;
  count: number;
  writePath?: string;
}

function readArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

function parseArgs(): CliArgs {
  const seedText = readArg("--seed");
  const countText = readArg("--count");
  const writePath = readArg("--write");

  if (!seedText || !countText) {
    throw new Error("Usage: pnpm scenarios:generate --seed <integer> --count <integer> [--write <path>]");
  }

  return {
    seed: Number(seedText),
    count: Number(countText),
    writePath
  };
}

async function validateScenarios(root: string, scenarios: unknown[]): Promise<void> {
  const ajv = new Ajv2020({ allErrors: true });
  addFormats(ajv);
  const schema = JSON.parse(await readFile(resolve(root, "schemas/scenario.schema.json"), "utf8")) as object;
  const validate = ajv.compile(schema);

  for (const scenario of scenarios) {
    if (!validate(scenario)) {
      throw new Error(`Generated scenario failed schema validation: ${JSON.stringify(validate.errors, null, 2)}`);
    }
  }
}

async function main(): Promise<void> {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const args = parseArgs();
  const result = generateScenarios({
    seed: args.seed,
    count: args.count,
    existingScenarios: curatedScenarios
  });
  await validateScenarios(root, result.scenarios);

  if (args.writePath) {
    const target = resolve(root, args.writePath);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, renderScenarioModule(result));
    return;
  }

  process.stdout.write(`${JSON.stringify(result.scenarios, null, 2)}\n`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
