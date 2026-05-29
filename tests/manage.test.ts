import { mkdir, mkdtemp, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

import type { IntegrationRoot } from "../src/integrations.js";
import { buildManageView, toggleManagedSkill } from "../src/manage.js";

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
