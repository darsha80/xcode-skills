import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

import type { IntegrationRoot } from "../src/integrations.js";
import { disableSkill, enableSkill } from "../src/lifecycle.js";

describe("disableSkill", () => {
  it("moves an enabled Skill Installation into the Disabled Skill Store", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const rootPath = join(workspace, "codex");
    const activeSkillsPath = join(rootPath, "skills");
    const disabledSkillsPath = join(rootPath, ".xcode-skills", "disabled");
    const activeSkillPath = join(activeSkillsPath, "diagnose");
    const disabledSkillPath = join(disabledSkillsPath, "diagnose");

    await mkdir(activeSkillPath, { recursive: true });
    await mkdir(rootPath, { recursive: true });
    await writeFile(join(activeSkillPath, "SKILL.md"), "# Diagnose\n");

    const integration: IntegrationRoot = {
      id: "codex",
      rootPath,
      activated: true,
      activeSkillsPath,
      disabledSkillsPath,
    };

    await expect(disableSkill(integration, "diagnose")).resolves.toEqual({
      integrationId: "codex",
      skillIdentity: "diagnose",
      status: "disabled",
    });

    await expect(stat(activeSkillPath)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(disabledSkillPath, "SKILL.md"), "utf8")).resolves.toBe(
      "# Diagnose\n",
    );
  });
});

describe("enableSkill", () => {
  it("moves a Disabled Skill Installation back into active skills", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const rootPath = join(workspace, "codex");
    const activeSkillsPath = join(rootPath, "skills");
    const disabledSkillsPath = join(rootPath, ".xcode-skills", "disabled");
    const activeSkillPath = join(activeSkillsPath, "diagnose");
    const disabledSkillPath = join(disabledSkillsPath, "diagnose");

    await mkdir(disabledSkillPath, { recursive: true });
    await writeFile(join(disabledSkillPath, "SKILL.md"), "# Diagnose\n");

    const integration: IntegrationRoot = {
      id: "codex",
      rootPath,
      activated: true,
      activeSkillsPath,
      disabledSkillsPath,
    };

    await expect(enableSkill(integration, "diagnose")).resolves.toEqual({
      integrationId: "codex",
      skillIdentity: "diagnose",
      status: "enabled",
    });

    await expect(stat(disabledSkillPath)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(activeSkillPath, "SKILL.md"), "utf8")).resolves.toBe(
      "# Diagnose\n",
    );
  });
});
