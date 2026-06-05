import { cp, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

import type { ResolvedSkillArtifact } from "./install.js";

export type CommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type CommandInvocation = {
  executable: string;
  args: string[];
  cwd: string;
};

export type CommandRunner = (command: CommandInvocation) => Promise<CommandResult>;

export type ResolveWithCliOptions = {
  tempRoot?: string;
  skillsCliPath?: string;
  runCommand?: CommandRunner;
  removeWorkspace?: (path: string) => Promise<void>;
  onVerbose?: (line: string) => void;
};

export async function resolveSkillArtifactWithCli(
  skillSpec: string,
  options: ResolveWithCliOptions = {},
): Promise<ResolvedSkillArtifact> {
  const workspace = await mkdtemp(join(options.tempRoot ?? tmpdir(), "xcode-skills-"));
  const removeWorkspace =
    options.removeWorkspace ??
    ((path: string) => rm(path, { recursive: true, force: true }));
  const runCommand = options.runCommand ?? spawnCommand;
  const skillsCliPath = options.skillsCliPath ?? defaultSkillsCliPath();

  try {
    const addArgs = resolveSkillsAddArgs(skillSpec);
    const invocation = {
      executable: process.execPath,
      args: [skillsCliPath, "add", ...addArgs, "--copy", "--yes"],
      cwd: workspace,
    };
    options.onVerbose?.(`workspace: ${workspace}`);
    options.onVerbose?.(`command: ${invocation.executable} ${invocation.args.join(" ")}`);
    const result = await runCommand(invocation);
    if (result.stdout.length > 0) {
      options.onVerbose?.(`stdout: ${result.stdout.trim()}`);
    }
    if (result.stderr.length > 0) {
      options.onVerbose?.(`stderr: ${result.stderr.trim()}`);
    }

    if (result.exitCode !== 0) {
      throw new Error(result.stderr || result.stdout || `skills add failed with exit code ${result.exitCode}`);
    }

    const skillRoot = join(workspace, ".agents", "skills");
    const skillIdentities = (await readdir(skillRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    if (skillIdentities.length !== 1) {
      throw new Error(`Expected one resolved Skill Folder, found ${skillIdentities.length}`);
    }

    const skillIdentity = skillIdentities[0]!;
    const artifactPath = join(skillRoot, skillIdentity);

    await copyLockFileIfPresent(workspace, artifactPath);

    return {
      skillIdentity,
      artifactPath,
      cleanup: () => removeWorkspace(workspace),
    };
  } catch (error) {
    await removeWorkspace(workspace);
    throw error;
  }
}

export function resolveSkillsAddArgs(skillSpec: string): string[] {
  const words = parseShellWords(skillSpec.trim());
  if (words.length >= 3 && words[0] === "npx" && words[1] === "skills" && words[2] === "add") {
    const addArgs = words.slice(3);
    if (addArgs.length === 0) {
      throw new Error("Pasted npx skills add command is missing a skill spec");
    }
    return addArgs;
  }

  return [skillSpec];
}

function parseShellWords(input: string): string[] {
  const words: string[] = [];
  let current = "";
  let quote: "'" | "\"" | undefined;
  let escaped = false;

  for (const char of input) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === "\\" && quote !== "'") {
      escaped = true;
      continue;
    }

    if (quote !== undefined) {
      if (char === quote) {
        quote = undefined;
      } else {
        current += char;
      }
      continue;
    }

    if (char === "'" || char === "\"") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current.length > 0) {
        words.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (escaped) {
    current += "\\";
  }
  if (quote !== undefined) {
    throw new Error("Unterminated quote in pasted npx skills add command");
  }
  if (current.length > 0) {
    words.push(current);
  }

  return words;
}

async function copyLockFileIfPresent(workspace: string, artifactPath: string): Promise<void> {
  try {
    await cp(join(workspace, "skills-lock.json"), join(artifactPath, "skills-lock.json"));
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return;
    }

    throw error;
  }
}

function defaultSkillsCliPath(): string {
  return join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "node_modules",
    "skills",
    "bin",
    "cli.mjs",
  );
}

function spawnCommand(command: CommandInvocation): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command.executable, command.args, {
      cwd: command.cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolve({ exitCode: exitCode ?? 1, stdout, stderr });
    });
  });
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
