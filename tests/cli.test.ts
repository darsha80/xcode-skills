import { mkdir, mkdtemp, stat, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

import type { IntegrationRoot } from "../src/integrations.js";
import { isCliEntrypoint, parseTargetAnswer, runCli } from "../src/cli.js";

const manageControlsHint =
  "Controls: Tab switch Codex/Claude | Up/Down or k/j move | Space/Enter toggle | q quit";

describe("runCli", () => {
  it("defaults target prompts to both when the user presses enter", () => {
    expect(parseTargetAnswer("")).toBe("both");
    expect(parseTargetAnswer("  \n")).toBe("both");
    expect(parseTargetAnswer("codex")).toBe("codex");
    expect(parseTargetAnswer("Claude")).toBe("claude");
  });

  it("detects npm bin symlink invocation as the CLI entrypoint", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const cliPath = join(workspace, "lib", "node_modules", "xcode-skills", "dist", "cli.js");
    const binPath = join(workspace, "bin", "xcode-skills");
    await mkdir(join(workspace, "bin"), { recursive: true });
    await mkdir(join(workspace, "lib", "node_modules", "xcode-skills", "dist"), {
      recursive: true,
    });
    await writeFile(cliPath, "#!/usr/bin/env node\n");
    await symlink(cliPath, binPath);

    await expect(isCliEntrypoint(pathToFileURL(cliPath).href, binPath)).resolves.toBe(true);
  });

  it("prints list output as JSON", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const codex = integration("codex", join(workspace, "codex"), true);
    await mkdir(join(codex.activeSkillsPath, "diagnose"), { recursive: true });
    await writeFile(join(codex.activeSkillsPath, "diagnose", "SKILL.md"), "# Diagnose\n");

    const result = await runCli(["list", "--json"], {
      resolveIntegrationRoots: async () => [codex],
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual([
      expect.objectContaining({
        integrationId: "codex",
        skillIdentity: "diagnose",
        state: "enabled",
      }),
    ]);
  });

  it("installs using an explicit target without prompting", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const artifactPath = join(workspace, "artifact", "diagnose");
    await mkdir(artifactPath, { recursive: true });
    await writeFile(join(artifactPath, "SKILL.md"), "# Diagnose\n");
    const codex = integration("codex", join(workspace, "codex"), true);
    await mkdir(codex.rootPath, { recursive: true });

    const result = await runCli(["install", "diagnose", "--target", "codex"], {
      resolveIntegrationRoots: async () => [codex],
      resolver: async () => ({ skillIdentity: "diagnose", artifactPath }),
      promptForTarget: async () => {
        throw new Error("should not prompt");
      },
    });

    expect(result).toEqual({
      exitCode: 0,
      stdout: "Codex: installed diagnose",
      stderr: "",
    });
  });

  it("fails before lifecycle work when a single explicit target is not activated", async () => {
    const claude = integration("claude", "/tmp/claude", false);

    const result = await runCli(["install", "diagnose", "--target", "claude"], {
      resolveIntegrationRoots: async () => [claude],
      resolver: async () => {
        throw new Error("should not resolve");
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/not activated/i);
  });

  it("disables a skill through the lifecycle command", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const codex = integration("codex", join(workspace, "codex"), true);
    await mkdir(join(codex.activeSkillsPath, "diagnose"), { recursive: true });
    await writeFile(join(codex.activeSkillsPath, "diagnose", "SKILL.md"), "# Diagnose\n");

    const result = await runCli(["disable", "diagnose", "--target", "codex"], {
      resolveIntegrationRoots: async () => [codex],
    });

    expect(result).toEqual({
      exitCode: 0,
      stdout: "Codex: disabled diagnose",
      stderr: "",
    });
  });

  it("dry-runs disable without moving the enabled Skill Installation", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const codex = integration("codex", join(workspace, "codex"), true);
    await mkdir(join(codex.activeSkillsPath, "diagnose"), { recursive: true });
    await writeFile(join(codex.activeSkillsPath, "diagnose", "SKILL.md"), "# Diagnose\n");

    const result = await runCli(["disable", "diagnose", "--target", "codex", "--dry-run"], {
      resolveIntegrationRoots: async () => [codex],
    });

    expect(result).toEqual({
      exitCode: 0,
      stdout: "Codex: would-disable diagnose",
      stderr: "",
    });
    await expect(stat(join(codex.activeSkillsPath, "diagnose"))).resolves.toBeDefined();
    await expect(stat(join(codex.disabledSkillsPath, "diagnose"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("prompts before overwriting a manual Skill Folder during install", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const artifactPath = join(workspace, "artifact", "diagnose");
    await mkdir(artifactPath, { recursive: true });
    await writeFile(join(artifactPath, "SKILL.md"), "# New Diagnose\n");
    const codex = integration("codex", join(workspace, "codex"), true);
    await mkdir(join(codex.activeSkillsPath, "diagnose"), { recursive: true });
    await writeFile(join(codex.activeSkillsPath, "diagnose", "SKILL.md"), "# Manual\n");

    const result = await runCli(["install", "diagnose", "--target", "codex"], {
      resolveIntegrationRoots: async () => [codex],
      resolver: async () => ({ skillIdentity: "diagnose", artifactPath }),
      confirm: async (message) => {
        expect(message).toContain("overwrite");
        expect(message).toContain(join(codex.activeSkillsPath, "diagnose"));
        return true;
      },
    });

    expect(result).toEqual({
      exitCode: 0,
      stdout: "Codex: installed diagnose",
      stderr: "",
    });
  });

  it("shows exact paths before uninstall confirmation", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const codex = integration("codex", join(workspace, "codex"), true);
    const activePath = join(codex.activeSkillsPath, "diagnose");
    await mkdir(activePath, { recursive: true });
    await writeFile(join(activePath, "SKILL.md"), "# Manual\n");

    const result = await runCli(["uninstall", "diagnose", "--target", "codex"], {
      resolveIntegrationRoots: async () => [codex],
      confirm: async (message) => {
        expect(message).toContain(activePath);
        return false;
      },
    });

    expect(result).toEqual({
      exitCode: 0,
      stdout: `Codex: needs-confirmation diagnose\n  ${activePath}`,
      stderr: "",
    });
  });

  it("uninstalls after the user confirms a destructive delete", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const codex = integration("codex", join(workspace, "codex"), true);
    const activePath = join(codex.activeSkillsPath, "diagnose");
    await mkdir(activePath, { recursive: true });
    await writeFile(join(activePath, "SKILL.md"), "# Manual\n");

    const result = await runCli(["uninstall", "diagnose", "--target", "codex"], {
      resolveIntegrationRoots: async () => [codex],
      confirm: async (message) => {
        expect(message).toContain(activePath);
        return true;
      },
    });

    expect(result).toEqual({
      exitCode: 0,
      stdout: "Codex: uninstalled diagnose",
      stderr: "",
    });
    await expect(stat(activePath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("shows exact paths during uninstall dry-run", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const codex = integration("codex", join(workspace, "codex"), true);
    const activePath = join(codex.activeSkillsPath, "diagnose");
    await mkdir(activePath, { recursive: true });
    await writeFile(join(activePath, "SKILL.md"), "# Diagnose\n");
    await writeFile(join(activePath, "skills-lock.json"), '{"version":1}\n');

    const result = await runCli(["uninstall", "diagnose", "--target", "codex", "--dry-run"], {
      resolveIntegrationRoots: async () => [codex],
    });

    expect(result).toEqual({
      exitCode: 0,
      stdout: `Codex: would-uninstall diagnose\n  ${activePath}`,
      stderr: "",
    });
  });

  it("includes resolver diagnostics when install runs with verbose output", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const artifactPath = join(workspace, "artifact", "diagnose");
    await mkdir(artifactPath, { recursive: true });
    await writeFile(join(artifactPath, "SKILL.md"), "# Diagnose\n");
    const codex = integration("codex", join(workspace, "codex"), true);
    await mkdir(codex.rootPath, { recursive: true });

    const result = await runCli(["install", "diagnose", "--target", "codex", "--verbose"], {
      resolveIntegrationRoots: async () => [codex],
      createResolver: (onVerbose) => async () => {
        onVerbose?.("workspace: /tmp/xcode-skills-abc");
        onVerbose?.("command: node skills add diagnose --copy --yes");
        onVerbose?.("stdout: resolver out");
        onVerbose?.("stderr: resolver err");
        return { skillIdentity: "diagnose", artifactPath };
      },
    });

    expect(result.stdout).toContain("Codex: installed diagnose");
    expect(result.stdout).toContain("workspace: /tmp/xcode-skills-abc");
    expect(result.stdout).toContain("command: node skills add diagnose --copy --yes");
    expect(result.stdout).toContain("stdout: resolver out");
    expect(result.stdout).toContain("stderr: resolver err");
  });

  it("includes resolver diagnostics when verbose install fails", async () => {
    const result = await runCli(["install", "diagnose", "--target", "codex", "--verbose"], {
      resolveIntegrationRoots: async () => [integration("codex", "/tmp/codex", true)],
      createResolver: (onVerbose) => async () => {
        onVerbose?.("workspace: /tmp/xcode-skills-abc");
        onVerbose?.("command: node skills add diagnose --copy --yes");
        throw new Error("resolver failed");
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("resolver failed");
    expect(result.stderr).toContain("workspace: /tmp/xcode-skills-abc");
    expect(result.stderr).toContain("command: node skills add diagnose --copy --yes");
  });

  it("emits verbose resolver diagnostics live instead of appending duplicates", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const artifactPath = join(workspace, "artifact", "diagnose");
    await mkdir(artifactPath, { recursive: true });
    await writeFile(join(artifactPath, "SKILL.md"), "# Diagnose\n");
    const codex = integration("codex", join(workspace, "codex"), true);
    await mkdir(codex.rootPath, { recursive: true });
    const emitted: string[] = [];

    const result = await runCli(["install", "diagnose", "--target", "codex", "--verbose"], {
      resolveIntegrationRoots: async () => [codex],
      emitVerboseLine: (line) => emitted.push(line),
      createResolver: (onVerbose) => async () => {
        onVerbose?.("workspace: /tmp/xcode-skills-abc");
        onVerbose?.("command: node skills add diagnose --copy --yes");
        return { skillIdentity: "diagnose", artifactPath };
      },
    });

    expect(result).toEqual({
      exitCode: 0,
      stdout: "Codex: installed diagnose",
      stderr: "",
    });
    expect(emitted).toEqual([
      "workspace: /tmp/xcode-skills-abc",
      "command: node skills add diagnose --copy --yes",
    ]);
  });

  it("renders the manage view instead of treating manage as an unknown command", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const codex = integration("codex", join(workspace, "codex"), true);
    const claude = integration("claude", join(workspace, "claude"), false);
    await mkdir(join(codex.activeSkillsPath, "diagnose"), { recursive: true });
    await writeFile(join(codex.activeSkillsPath, "diagnose", "SKILL.md"), "# Diagnose\n");

    const result = await runCli(["manage"], {
      resolveIntegrationRoots: async () => [codex, claude],
    });

    expect(result).toEqual({
      exitCode: 0,
      stdout: `Codex\n  diagnose  enabled\n\nClaude\n  not activated in Xcode\n\n${manageControlsHint}`,
      stderr: "",
    });
  });

  it("supports keyboard toggling in manage mode", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const codex = integration("codex", join(workspace, "codex"), true);
    await mkdir(join(codex.activeSkillsPath, "diagnose"), { recursive: true });
    await writeFile(join(codex.activeSkillsPath, "diagnose", "SKILL.md"), "# Diagnose\n");
    const keys = [" ", "q"];

    const result = await runCli(["manage"], {
      resolveIntegrationRoots: async () => [codex],
      readManageKey: async () => keys.shift() ?? "q",
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("diagnose  disabled");
  });

  it("rejects multiple skill arguments for install", async () => {
    const result = await runCli(["install", "diagnose", "handoff", "--target", "codex"], {
      resolveIntegrationRoots: async () => [integration("codex", "/tmp/codex", true)],
    });

    expect(result).toEqual({
      exitCode: 1,
      stdout: "",
      stderr: "install accepts exactly one skill argument",
    });
  });
});

function integration(
  id: IntegrationRoot["id"],
  rootPath: string,
  activated: boolean,
): IntegrationRoot {
  return {
    id,
    rootPath,
    activated,
    activeSkillsPath: join(rootPath, "skills"),
    disabledSkillsPath: join(rootPath, ".xcode-skills", "disabled"),
  };
}
