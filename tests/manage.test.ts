import { mkdir, mkdtemp, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

import type { IntegrationRoot } from "../src/integrations.js";
import { buildManageView, runManageSession, toggleManagedSkill } from "../src/manage.js";

describe("manage adapter", () => {
  it("builds Codex and Claude tabs and marks inactive integrations", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const codex = integration("codex", join(workspace, "codex"), true);
    const claude = integration("claude", join(workspace, "claude"), false);
    await mkdir(join(codex.activeSkillsPath, "diagnose"), { recursive: true });
    await writeFile(join(codex.activeSkillsPath, "diagnose", "SKILL.md"), "# Diagnose\n");

    await expect(buildManageView([codex, claude])).resolves.toEqual([
      {
        integrationId: "codex",
        activated: true,
        skills: [
          expect.objectContaining({
            skillIdentity: "diagnose",
            state: "enabled",
          }),
        ],
      },
      {
        integrationId: "claude",
        activated: false,
        skills: [],
      },
    ]);
  });

  it("toggles enabled skills into the Disabled Skill Store immediately", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const codex = integration("codex", join(workspace, "codex"), true);
    await mkdir(join(codex.activeSkillsPath, "diagnose"), { recursive: true });
    await writeFile(join(codex.activeSkillsPath, "diagnose", "SKILL.md"), "# Diagnose\n");

    await expect(toggleManagedSkill(codex, "diagnose")).resolves.toEqual({
      integrationId: "codex",
      skillIdentity: "diagnose",
      status: "disabled",
    });
    await expect(stat(join(codex.disabledSkillsPath, "diagnose"))).resolves.toBeDefined();
  });

  it("renders before and after keyboard toggles", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const codex = integration("codex", join(workspace, "codex"), true);
    await mkdir(join(codex.activeSkillsPath, "diagnose"), { recursive: true });
    await writeFile(join(codex.activeSkillsPath, "diagnose", "SKILL.md"), "# Diagnose\n");
    const keys = [" ", "q"];
    const renders: string[] = [];

    await runManageSession([codex], {
      readKey: async () => keys.shift() ?? "q",
      render: (screen) => renders.push(screen),
    });

    expect(renders[0]).toContain("diagnose  enabled");
    expect(renders[1]).toContain("diagnose  disabled");
  });

  it("uses up and down keys to toggle the selected skill, not always the first skill", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const codex = integration("codex", join(workspace, "codex"), true);
    await mkdir(join(codex.activeSkillsPath, "alpha"), { recursive: true });
    await mkdir(join(codex.activeSkillsPath, "zulu"), { recursive: true });
    await writeFile(join(codex.activeSkillsPath, "alpha", "SKILL.md"), "# Alpha\n");
    await writeFile(join(codex.activeSkillsPath, "zulu", "SKILL.md"), "# Zulu\n");
    const keys = ["\u001B[B", " ", "q"];

    const output = await runManageSession([codex], {
      readKey: async () => keys.shift() ?? "q",
    });

    expect(output).toContain("alpha  enabled");
    expect(output).toContain("zulu  disabled");
  });

  it("switches tabs before toggling a selected skill", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const codex = integration("codex", join(workspace, "codex"), true);
    const claude = integration("claude", join(workspace, "claude"), true);
    await mkdir(join(codex.activeSkillsPath, "codex-skill"), { recursive: true });
    await mkdir(join(claude.activeSkillsPath, "claude-skill"), { recursive: true });
    await writeFile(join(codex.activeSkillsPath, "codex-skill", "SKILL.md"), "# Codex\n");
    await writeFile(join(claude.activeSkillsPath, "claude-skill", "SKILL.md"), "# Claude\n");
    const keys = ["\t", " ", "q"];

    const output = await runManageSession([codex, claude], {
      readKey: async () => keys.shift() ?? "q",
    });

    expect(output).toContain("codex-skill  enabled");
    expect(output).toContain("claude-skill  disabled");
  });

  it("shows active tab and selected skill markers while rendering an interactive session", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const codex = integration("codex", join(workspace, "codex"), true);
    const claude = integration("claude", join(workspace, "claude"), true);
    await mkdir(join(codex.activeSkillsPath, "diagnose"), { recursive: true });
    await mkdir(join(claude.activeSkillsPath, "handoff"), { recursive: true });
    await writeFile(join(codex.activeSkillsPath, "diagnose", "SKILL.md"), "# Diagnose\n");
    await writeFile(join(claude.activeSkillsPath, "handoff", "SKILL.md"), "# Handoff\n");
    const keys = ["\t", "q"];
    const renders: string[] = [];

    await runManageSession([codex, claude], {
      readKey: async () => keys.shift() ?? "q",
      render: (screen) => renders.push(screen),
    });

    expect(renders[0]).toContain("\x1B[32mCodex\x1B[39m");
    expect(renders[0]).toContain("> diagnose  enabled");
    expect(renders[0]).toContain(
      "Controls: Tab switch Codex/Claude | Up/Down or k/j move | Space/Enter toggle | q quit",
    );
    expect(renders[1]).toContain("\x1B[32mClaude\x1B[39m");
    expect(renders[1]).toContain("> handoff  enabled");
    expect(renders[1]).toContain(
      "Controls: Tab switch Codex/Claude | Up/Down or k/j move | Space/Enter toggle | q quit",
    );
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
