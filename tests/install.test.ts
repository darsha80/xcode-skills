import { mkdir, mkdtemp, readFile, stat, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

import type { IntegrationRoot } from "../src/integrations.js";
import { installSkill } from "../src/install.js";

describe("installSkill", () => {
  it("resolves once and installs the same Skill Folder into activated target integrations", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const artifactPath = join(workspace, "artifact", "diagnose");
    await mkdir(artifactPath, { recursive: true });
    await writeFile(join(artifactPath, "SKILL.md"), "# Diagnose\n");
    await writeFile(join(artifactPath, "skills-lock.json"), '{"version":1}\n');

    const codex = integration("codex", join(workspace, "codex"), true);
    const claude = integration("claude", join(workspace, "ClaudeAgentConfig"), true);
    await mkdir(codex.rootPath, { recursive: true });
    await mkdir(claude.rootPath, { recursive: true });

    let calls = 0;
    const result = await installSkill({
      skillSpec: "mattpocock/skills/diagnose",
      integrations: [codex, claude],
      resolver: async () => {
        calls += 1;
        return { skillIdentity: "diagnose", artifactPath };
      },
    });

    expect(calls).toBe(1);
    expect(result).toEqual([
      { integrationId: "codex", skillIdentity: "diagnose", status: "installed" },
      { integrationId: "claude", skillIdentity: "diagnose", status: "installed" },
    ]);
    await expect(readFile(join(codex.activeSkillsPath, "diagnose", "SKILL.md"), "utf8"))
      .resolves.toBe("# Diagnose\n");
    await expect(readFile(join(claude.activeSkillsPath, "diagnose", "skills-lock.json"), "utf8"))
      .resolves.toBe('{"version":1}\n');
  });

  it("allows partial success for missing integrations when both targets are selected", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const artifactPath = join(workspace, "artifact", "diagnose");
    await mkdir(artifactPath, { recursive: true });
    await writeFile(join(artifactPath, "SKILL.md"), "# Diagnose\n");

    const codex = integration("codex", join(workspace, "codex"), true);
    const claude = integration("claude", join(workspace, "ClaudeAgentConfig"), false);
    await mkdir(codex.rootPath, { recursive: true });

    const result = await installSkill({
      skillSpec: "diagnose",
      integrations: [codex, claude],
      resolver: async () => ({ skillIdentity: "diagnose", artifactPath }),
    });

    expect(result).toEqual([
      { integrationId: "codex", skillIdentity: "diagnose", status: "installed" },
      { integrationId: "claude", skillIdentity: "diagnose", status: "not-activated" },
    ]);
    await expect(stat(join(codex.activeSkillsPath, "diagnose"))).resolves.toBeDefined();
  });

  it("rejects resolved artifacts that contain symlinks", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const artifactPath = join(workspace, "artifact", "diagnose");
    await mkdir(artifactPath, { recursive: true });
    await writeFile(join(artifactPath, "SKILL.md"), "# Diagnose\n");
    await writeFile(join(workspace, "outside.txt"), "secret\n");
    await symlink(join(workspace, "outside.txt"), join(artifactPath, "linked.txt"));

    const codex = integration("codex", join(workspace, "codex"), true);
    await mkdir(codex.rootPath, { recursive: true });

    await expect(
      installSkill({
        skillSpec: "diagnose",
        integrations: [codex],
        resolver: async () => ({ skillIdentity: "diagnose", artifactPath }),
      }),
    ).rejects.toThrow(/symlink/);
    await expect(stat(join(codex.activeSkillsPath, "diagnose"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("rejects resolved artifacts without a root SKILL.md", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const artifactPath = join(workspace, "artifact", "diagnose");
    await mkdir(artifactPath, { recursive: true });
    await writeFile(join(artifactPath, "README.md"), "# Diagnose\n");

    const codex = integration("codex", join(workspace, "codex"), true);
    await mkdir(codex.rootPath, { recursive: true });

    await expect(
      installSkill({
        skillSpec: "diagnose",
        integrations: [codex],
        resolver: async () => ({ skillIdentity: "diagnose", artifactPath }),
      }),
    ).rejects.toThrow(/SKILL\.md/);
    await expect(stat(join(codex.activeSkillsPath, "diagnose"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("removes a disabled copy when installing the same Skill Identity", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const artifactPath = join(workspace, "artifact", "diagnose");
    await mkdir(artifactPath, { recursive: true });
    await writeFile(join(artifactPath, "SKILL.md"), "# New Diagnose\n");

    const codex = integration("codex", join(workspace, "codex"), true);
    await mkdir(join(codex.disabledSkillsPath, "diagnose"), { recursive: true });
    await writeFile(
      join(codex.disabledSkillsPath, "diagnose", "SKILL.md"),
      "# Old Diagnose\n",
    );

    await installSkill({
      skillSpec: "diagnose",
      integrations: [codex],
      resolver: async () => ({ skillIdentity: "diagnose", artifactPath }),
    });

    await expect(readFile(join(codex.activeSkillsPath, "diagnose", "SKILL.md"), "utf8"))
      .resolves.toBe("# New Diagnose\n");
    await expect(stat(join(codex.disabledSkillsPath, "diagnose"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("resolves but does not write to Xcode integration roots during dry run", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const artifactPath = join(workspace, "artifact", "diagnose");
    await mkdir(artifactPath, { recursive: true });
    await writeFile(join(artifactPath, "SKILL.md"), "# Diagnose\n");

    const codex = integration("codex", join(workspace, "codex"), true);
    await mkdir(codex.rootPath, { recursive: true });

    let calls = 0;
    const result = await installSkill({
      skillSpec: "diagnose",
      integrations: [codex],
      dryRun: true,
      resolver: async () => {
        calls += 1;
        return { skillIdentity: "diagnose", artifactPath };
      },
    });

    expect(calls).toBe(1);
    expect(result).toEqual([
      { integrationId: "codex", skillIdentity: "diagnose", status: "would-install" },
    ]);
    await expect(stat(join(codex.activeSkillsPath, "diagnose"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("requires confirmation before overwriting an enabled no-lock Skill Folder", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const artifactPath = join(workspace, "artifact", "diagnose");
    await mkdir(artifactPath, { recursive: true });
    await writeFile(join(artifactPath, "SKILL.md"), "# New Diagnose\n");

    const codex = integration("codex", join(workspace, "codex"), true);
    const existingPath = join(codex.activeSkillsPath, "diagnose");
    await mkdir(existingPath, { recursive: true });
    await writeFile(join(existingPath, "SKILL.md"), "# Manual Diagnose\n");

    const result = await installSkill({
      skillSpec: "diagnose",
      integrations: [codex],
      resolver: async () => ({ skillIdentity: "diagnose", artifactPath }),
    });

    expect(result).toEqual([
      {
        integrationId: "codex",
        skillIdentity: "diagnose",
        status: "needs-confirmation",
      },
    ]);
    await expect(readFile(join(existingPath, "SKILL.md"), "utf8")).resolves.toBe(
      "# Manual Diagnose\n",
    );
  });

  it("overwrites an enabled no-lock Skill Folder when confirmation is bypassed", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const artifactPath = join(workspace, "artifact", "diagnose");
    await mkdir(artifactPath, { recursive: true });
    await writeFile(join(artifactPath, "SKILL.md"), "# New Diagnose\n");

    const codex = integration("codex", join(workspace, "codex"), true);
    const existingPath = join(codex.activeSkillsPath, "diagnose");
    await mkdir(existingPath, { recursive: true });
    await writeFile(join(existingPath, "SKILL.md"), "# Manual Diagnose\n");

    const result = await installSkill({
      skillSpec: "diagnose",
      integrations: [codex],
      yes: true,
      resolver: async () => ({ skillIdentity: "diagnose", artifactPath }),
    });

    expect(result).toEqual([
      { integrationId: "codex", skillIdentity: "diagnose", status: "installed" },
    ]);
    await expect(readFile(join(existingPath, "SKILL.md"), "utf8")).resolves.toBe(
      "# New Diagnose\n",
    );
  });

  it("reports confirmation requirements during dry run instead of prompting", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const artifactPath = join(workspace, "artifact", "diagnose");
    await mkdir(artifactPath, { recursive: true });
    await writeFile(join(artifactPath, "SKILL.md"), "# New Diagnose\n");

    const codex = integration("codex", join(workspace, "codex"), true);
    const existingPath = join(codex.activeSkillsPath, "diagnose");
    await mkdir(existingPath, { recursive: true });
    await writeFile(join(existingPath, "SKILL.md"), "# Manual Diagnose\n");

    const result = await installSkill({
      skillSpec: "diagnose",
      integrations: [codex],
      dryRun: true,
      resolver: async () => ({ skillIdentity: "diagnose", artifactPath }),
    });

    expect(result).toEqual([
      {
        integrationId: "codex",
        skillIdentity: "diagnose",
        status: "would-need-confirmation",
      },
    ]);
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
