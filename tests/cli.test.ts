import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

import type { IntegrationRoot } from "../src/integrations.js";
import { runCli } from "../src/cli.js";

describe("runCli", () => {
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
