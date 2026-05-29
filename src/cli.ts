#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { createInterface } from "node:readline/promises";

import type { SkillArtifactResolver } from "./install.js";
import { type InstallResult, installSkill } from "./install.js";
import { resolveIntegrationRoots, type IntegrationRoot } from "./integrations.js";
import { formatListHuman, formatListJson, listSkillInstallations } from "./list.js";
import { type LifecycleResult, disableSkill, enableSkill } from "./lifecycle.js";
import { resolveSkillArtifactWithCli } from "./resolver.js";
import { selectTargetIntegrations, type PromptForTarget, type TargetSelection } from "./targets.js";
import { type UninstallResult, uninstallSkill } from "./uninstall.js";

export type CliResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type CliDependencies = {
  resolveIntegrationRoots?: () => Promise<IntegrationRoot[]>;
  resolver?: SkillArtifactResolver;
  promptForTarget?: PromptForTarget;
};

export async function runCli(
  argv: string[],
  dependencies: CliDependencies = {},
): Promise<CliResult> {
  try {
    const parsed = parseArgs(argv);
    const integrations = await (dependencies.resolveIntegrationRoots ?? resolveIntegrationRoots)();

    if (parsed.command === "list") {
      const entries = await listSkillInstallations(integrations, { target: parsed.target });
      return ok(parsed.json ? formatListJson(entries) : formatListHuman(entries));
    }

    const skillArg = parsed.args[0];
    if (skillArg === undefined) {
      return fail(`Missing required argument for ${parsed.command}`);
    }

    const selectedIntegrations = await selectTargetIntegrations({
      integrations,
      target: parsed.target,
      promptForTarget: dependencies.promptForTarget ?? promptForTargetFromStdin,
    });

    if (parsed.command === "install") {
      const results = await installSkill({
        skillSpec: skillArg,
        integrations: selectedIntegrations,
        resolver: dependencies.resolver ?? resolveSkillArtifactWithCli,
        dryRun: parsed.dryRun,
        yes: parsed.yes,
      });
      return ok(formatInstallResults(results));
    }

    if (parsed.command === "enable" || parsed.command === "disable") {
      const results = await Promise.all(
        selectedIntegrations.map((integration) =>
          parsed.command === "enable"
            ? enableSkill(integration, skillArg)
            : disableSkill(integration, skillArg),
        ),
      );
      return ok(formatLifecycleResults(results));
    }

    if (parsed.command === "uninstall") {
      const results = await Promise.all(
        selectedIntegrations.map((integration) =>
          uninstallSkill(integration, skillArg, {
            dryRun: parsed.dryRun,
            yes: parsed.yes,
          }),
        ),
      );
      return ok(formatUninstallResults(results));
    }

    return fail(`Unknown command: ${parsed.command}`);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

type ParsedArgs = {
  command: string;
  args: string[];
  target?: TargetSelection;
  yes: boolean;
  dryRun: boolean;
  verbose: boolean;
  json: boolean;
};

function parseArgs(argv: string[]): ParsedArgs {
  const [command = "help", ...rest] = argv;
  const args: string[] = [];
  let target: TargetSelection | undefined;
  let yes = false;
  let dryRun = false;
  let verbose = false;
  let json = false;

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index]!;
    if (token === "--target") {
      const value = rest[index + 1];
      if (value !== "codex" && value !== "claude" && value !== "both") {
        throw new Error(`Invalid target: ${value ?? ""}`);
      }
      target = value;
      index += 1;
      continue;
    }
    if (token === "--yes" || token === "-y") {
      yes = true;
      continue;
    }
    if (token === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (token === "--verbose") {
      verbose = true;
      continue;
    }
    if (token === "--json") {
      json = true;
      continue;
    }
    args.push(token);
  }

  return { command, args, target, yes, dryRun, verbose, json };
}

function ok(stdout: string): CliResult {
  return { exitCode: 0, stdout, stderr: "" };
}

function fail(stderr: string): CliResult {
  return { exitCode: 1, stdout: "", stderr };
}

function formatInstallResults(results: InstallResult[]): string {
  return results
    .map((result) => `${displayIntegration(result.integrationId)}: ${result.status} ${result.skillIdentity}`)
    .join("\n");
}

function formatLifecycleResults(results: LifecycleResult[]): string {
  return results
    .map((result) => `${displayIntegration(result.integrationId)}: ${result.status} ${result.skillIdentity}`)
    .join("\n");
}

function formatUninstallResults(results: UninstallResult[]): string {
  return results
    .map((result) => `${displayIntegration(result.integrationId)}: ${result.status} ${result.skillIdentity}`)
    .join("\n");
}

function displayIntegration(id: IntegrationRoot["id"]): string {
  return id === "codex" ? "Codex" : "Claude";
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await runCli(process.argv.slice(2));
  if (result.stdout.length > 0) {
    process.stdout.write(`${result.stdout}\n`);
  }
  if (result.stderr.length > 0) {
    process.stderr.write(`${result.stderr}\n`);
  }
  process.exitCode = result.exitCode;
}

async function promptForTargetFromStdin(): Promise<TargetSelection> {
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = (
      await readline.question("Target Agent Integration (codex/claude/both): ")
    )
      .trim()
      .toLowerCase();

    if (answer === "codex" || answer === "claude" || answer === "both") {
      return answer;
    }

    throw new Error(`Invalid target: ${answer}`);
  } finally {
    readline.close();
  }
}
