import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

import type { IntegrationRoot } from "../src/integrations.js";
import { uninstallSkill } from "../src/uninstall.js";

describe("uninstallSkill", () => {
  it("removes enabled and disabled copies for a Skill Identity", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const codex = integration("codex", join(workspace, "codex"), true);
    const activePath = join(codex.activeSkillsPath, "diagnose");
    const disabledPath = join(codex.disabledSkillsPath, "diagnose");

    await mkdir(activePath, { recursive: true });
    await mkdir(disabledPath, { recursive: true });
    await writeFile(join(activePath, "SKILL.md"), "# Active\n");
    await writeFile(join(activePath, "skills-lock.json"), '{"version":1}\n');
    await writeFile(join(disabledPath, "SKILL.md"), "# Disabled\n");
    await writeFile(join(disabledPath, "skills-lock.json"), '{"version":1}\n');

    await expect(uninstallSkill(codex, "diagnose")).resolves.toEqual({
      integrationId: "codex",
      skillIdentity: "diagnose",
      status: "uninstalled",
      removedPaths: [activePath, disabledPath],
    });
    await expect(stat(activePath)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(stat(disabledPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("reports not-installed when no enabled or disabled copy exists", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const codex = integration("codex", join(workspace, "codex"), true);

    await expect(uninstallSkill(codex, "diagnose")).resolves.toEqual({
      integrationId: "codex",
      skillIdentity: "diagnose",
      status: "not-installed",
      removedPaths: [],
    });
  });

  it("reports removable paths without deleting them during dry run", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const codex = integration("codex", join(workspace, "codex"), true);
    const activePath = join(codex.activeSkillsPath, "diagnose");
    await mkdir(activePath, { recursive: true });
    await writeFile(join(activePath, "SKILL.md"), "# Active\n");
    await writeFile(join(activePath, "skills-lock.json"), '{"version":1}\n');

    await expect(uninstallSkill(codex, "diagnose", { dryRun: true })).resolves.toEqual({
      integrationId: "codex",
      skillIdentity: "diagnose",
      status: "would-uninstall",
      removedPaths: [activePath],
    });
    await expect(stat(activePath)).resolves.toBeDefined();
  });

  it("reports confirmation requirements during dry run for no-lock folders", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const codex = integration("codex", join(workspace, "codex"), true);
    const activePath = join(codex.activeSkillsPath, "diagnose");
    await mkdir(activePath, { recursive: true });
    await writeFile(join(activePath, "SKILL.md"), "# Manual\n");

    await expect(uninstallSkill(codex, "diagnose", { dryRun: true })).resolves.toEqual({
      integrationId: "codex",
      skillIdentity: "diagnose",
      status: "would-need-confirmation",
      removedPaths: [activePath],
    });
    await expect(stat(activePath)).resolves.toBeDefined();
  });

  it("requires confirmation before deleting a no-lock Skill Folder", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const codex = integration("codex", join(workspace, "codex"), true);
    const activePath = join(codex.activeSkillsPath, "diagnose");
    await mkdir(activePath, { recursive: true });
    await writeFile(join(activePath, "SKILL.md"), "# Manual\n");

    await expect(uninstallSkill(codex, "diagnose")).resolves.toEqual({
      integrationId: "codex",
      skillIdentity: "diagnose",
      status: "needs-confirmation",
      removedPaths: [activePath],
    });
    await expect(readFile(join(activePath, "SKILL.md"), "utf8")).resolves.toBe("# Manual\n");
  });

  it("deletes a no-lock Skill Folder when confirmation is bypassed", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const codex = integration("codex", join(workspace, "codex"), true);
    const activePath = join(codex.activeSkillsPath, "diagnose");
    await mkdir(activePath, { recursive: true });
    await writeFile(join(activePath, "SKILL.md"), "# Manual\n");

    await expect(uninstallSkill(codex, "diagnose", { yes: true })).resolves.toEqual({
      integrationId: "codex",
      skillIdentity: "diagnose",
      status: "uninstalled",
      removedPaths: [activePath],
    });
    await expect(stat(activePath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("requires confirmation before deleting a suspicious folder even when it has a lock file", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const codex = integration("codex", join(workspace, "codex"), true);
    const activePath = join(codex.activeSkillsPath, "not-a-skill");
    await mkdir(activePath, { recursive: true });
    await writeFile(join(activePath, "skills-lock.json"), '{"version":1}\n');

    await expect(uninstallSkill(codex, "not-a-skill")).resolves.toEqual({
      integrationId: "codex",
      skillIdentity: "not-a-skill",
      status: "needs-confirmation",
      removedPaths: [activePath],
    });
    await expect(stat(activePath)).resolves.toBeDefined();
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
