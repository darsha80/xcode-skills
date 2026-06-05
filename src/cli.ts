#!/usr/bin/env node
import { realpath } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";

import type { SkillArtifactResolver } from "./install.js";
import { type InstallResult, installSkill } from "./install.js";
import { resolveIntegrationRoots, type IntegrationRoot } from "./integrations.js";
import { formatListHuman, formatListJson, listSkillInstallations } from "./list.js";
import { buildManageView, formatManageView, runManageSession } from "./manage.js";
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
  createResolver?: (onVerbose?: (line: string) => void) => SkillArtifactResolver;
  emitVerboseLine?: (line: string) => void;
  promptForTarget?: PromptForTarget;
  confirm?: (message: string) => Promise<boolean>;
  readManageKey?: () => Promise<string>;
};

export async function runCli(
  argv: string[],
  dependencies: CliDependencies = {},
): Promise<CliResult> {
  const verboseLines: string[] = [];
  let verbose = false;
  const recordVerbose = (line: string) => {
    verboseLines.push(line);
    dependencies.emitVerboseLine?.(line);
  };
  const shouldAppendVerbose = () => verbose && dependencies.emitVerboseLine === undefined;

  try {
    const parsed = parseArgs(argv);
    verbose = parsed.verbose;
    const integrations = await (dependencies.resolveIntegrationRoots ?? resolveIntegrationRoots)();

    if (parsed.command === "list") {
      const entries = await listSkillInstallations(integrations, { target: parsed.target });
      return ok(parsed.json ? formatListJson(entries) : formatListHuman(entries));
    }

    if (parsed.command === "manage") {
      const readKey =
        dependencies.readManageKey ??
        (process.stdin.isTTY ? readManageKeyFromStdin : undefined);
      if (readKey !== undefined) {
        const interactiveTty = dependencies.readManageKey === undefined && process.stdin.isTTY;
        const output = await runManageSession(integrations, {
          readKey,
          render: interactiveTty
            ? (screen) => {
                process.stdout.write(`\x1Bc${screen}\n`);
              }
            : undefined,
        });
        return ok(interactiveTty ? "" : output);
      }
      return ok(formatManageView(await buildManageView(integrations)));
    }

    const skillArg = skillArgumentForCommand(parsed.command, parsed.args);
    if (skillArg === undefined) {
      return fail(`Missing required argument for ${parsed.command}`);
    }
    if (
      ["install", "uninstall", "enable", "disable"].includes(parsed.command) &&
      skillArg === undefined
    ) {
      return fail(`${parsed.command} accepts exactly one skill argument`);
    }
    if (
      ["uninstall", "enable", "disable"].includes(parsed.command) &&
      parsed.args.length !== 1
    ) {
      return fail(`${parsed.command} accepts exactly one skill argument`);
    }
    if (
      parsed.command === "install" &&
      parsed.args.length !== 1 &&
      !isPastedNpxSkillsAddArgs(parsed.args)
    ) {
      return fail("install accepts exactly one skill argument");
    }

    const selectedIntegrations = await selectTargetIntegrations({
      integrations,
      target: parsed.target,
      promptForTarget: dependencies.promptForTarget ?? promptForTargetFromStdin,
    });

    if (parsed.command === "install") {
      const resolver =
        dependencies.resolver ??
        dependencies.createResolver?.(recordVerbose) ??
        ((skillSpec: string) =>
          resolveSkillArtifactWithCli(skillSpec, {
            onVerbose: parsed.verbose ? recordVerbose : undefined,
          }));
      const results = await installSkill({
        skillSpec: skillArg,
        integrations: selectedIntegrations,
        resolver,
        dryRun: parsed.dryRun,
        yes: parsed.yes,
        confirmOverwrite:
          parsed.yes || parsed.dryRun
            ? undefined
            : (path) => confirmWithDependencies(dependencies, `overwrite manual Skill Folder?\n  ${path}`),
      });
      return ok(withVerbose(formatInstallResults(results), shouldAppendVerbose() ? verboseLines : []));
    }

    if (parsed.command === "enable" || parsed.command === "disable") {
      const results = await Promise.all(
        selectedIntegrations.map((integration) =>
          parsed.command === "enable"
            ? enableSkill(integration, skillArg, { dryRun: parsed.dryRun })
            : disableSkill(integration, skillArg, { dryRun: parsed.dryRun }),
        ),
      );
      return ok(formatLifecycleResults(results));
    }

    if (parsed.command === "uninstall") {
      let results = await Promise.all(
        selectedIntegrations.map((integration) =>
          uninstallSkill(integration, skillArg, {
            dryRun: parsed.dryRun,
            yes: parsed.yes,
          }),
        ),
      );
      if (!parsed.dryRun && !parsed.yes && results.some((result) => result.status === "needs-confirmation")) {
        const confirmed = await confirmWithDependencies(
          dependencies,
          [
            "delete these Skill Installation paths?",
            ...results.flatMap((result) => result.removedPaths.map((path) => `  ${path}`)),
          ].join("\n"),
        );
        if (confirmed) {
          results = await Promise.all(
            selectedIntegrations.map((integration) =>
              uninstallSkill(integration, skillArg, {
                yes: true,
              }),
            ),
          );
        }
      }
      return ok(formatUninstallResults(results));
    }

    return fail(`Unknown command: ${parsed.command}`);
  } catch (error) {
    return fail(withVerbose(error instanceof Error ? error.message : String(error), shouldAppendVerbose() ? verboseLines : []));
  }
}

function skillArgumentForCommand(command: string, args: string[]): string | undefined {
  if (command === "install" && isPastedNpxSkillsAddArgs(args)) {
    return args.join(" ");
  }

  return args[0];
}

function isPastedNpxSkillsAddArgs(args: string[]): boolean {
  return args.length >= 3 && args[0] === "npx" && args[1] === "skills" && args[2] === "add";
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
    .map((result) => {
      const header = `${displayIntegration(result.integrationId)}: ${result.status} ${result.skillIdentity}`;
      if (
        !["needs-confirmation", "would-need-confirmation", "would-uninstall"].includes(result.status) ||
        result.removedPaths.length === 0
      ) {
        return header;
      }
      return [header, ...result.removedPaths.map((path) => `  ${path}`)].join("\n");
    })
    .join("\n");
}

function withVerbose(stdout: string, verboseLines: string[]): string {
  if (verboseLines.length === 0) {
    return stdout;
  }

  return [stdout, "", "Verbose", ...verboseLines].join("\n");
}

function displayIntegration(id: IntegrationRoot["id"]): string {
  return id === "codex" ? "Codex" : "Claude";
}

export async function isCliEntrypoint(
  moduleUrl: string = import.meta.url,
  argvPath: string | undefined = process.argv[1],
  resolveRealPath: (path: string) => Promise<string> = realpath,
): Promise<boolean> {
  if (argvPath === undefined) {
    return false;
  }

  const modulePath = fileURLToPath(moduleUrl);
  try {
    const [resolvedModulePath, resolvedArgvPath] = await Promise.all([
      resolveRealPath(modulePath),
      resolveRealPath(argvPath),
    ]);
    return resolvedModulePath === resolvedArgvPath;
  } catch {
    return modulePath === argvPath;
  }
}

if (await isCliEntrypoint()) {
  const result = await runCli(process.argv.slice(2), {
    emitVerboseLine: (line) => {
      process.stderr.write(`${line}\n`);
    },
  });
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
    return parseTargetAnswer(
      await readline.question("Target Agent Integration (codex/claude/both) [both]: "),
    );
  } finally {
    readline.close();
  }
}

export function parseTargetAnswer(answer: string): TargetSelection {
  const normalized = answer.trim().toLowerCase();

  if (normalized === "") {
    return "both";
  }

  if (normalized === "codex" || normalized === "claude" || normalized === "both") {
    return normalized;
  }

  throw new Error(`Invalid target: ${normalized}`);
}

async function confirmWithDependencies(
  dependencies: CliDependencies,
  message: string,
): Promise<boolean> {
  if (dependencies.confirm !== undefined) {
    return dependencies.confirm(message);
  }

  return confirmFromStdin(message);
}

async function confirmFromStdin(message: string): Promise<boolean> {
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = (await readline.question(`${message}\nContinue? (y/N): `))
      .trim()
      .toLowerCase();
    return answer === "y" || answer === "yes";
  } finally {
    readline.close();
  }
}

async function readManageKeyFromStdin(): Promise<string> {
  const stdin = process.stdin;
  if (stdin.setRawMode !== undefined) {
    stdin.setRawMode(true);
  }
  stdin.resume();
  stdin.setEncoding("utf8");

  return new Promise((resolve) => {
    const onData = (chunk: string) => {
      stdin.off("data", onData);
      if (stdin.setRawMode !== undefined) {
        stdin.setRawMode(false);
      }
      stdin.pause();
      resolve(chunk === "\u0003" ? "q" : chunk);
    };
    stdin.on("data", onData);
  });
}
