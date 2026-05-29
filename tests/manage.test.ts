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
