import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

import type { IntegrationRoot } from "../src/integrations.js";
import { scanIntegrationSkills } from "../src/filesystem-state.js";

describe("scanIntegrationSkills", () => {
  it("reports an enabled Skill Folder with unknown provenance when no Skill Lock File exists", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const rootPath = join(workspace, "codex");
    const activeSkillsPath = join(rootPath, "skills");
    const disabledSkillsPath = join(rootPath, ".xcode-skills", "disabled");
    const skillPath = join(activeSkillsPath, "diagnose");

    await mkdir(skillPath, { recursive: true });
    await writeFile(join(skillPath, "SKILL.md"), "# Diagnose\n");

    const integration: IntegrationRoot = {
      id: "codex",
      rootPath,
      activated: true,
      activeSkillsPath,
      disabledSkillsPath,
    };

    await expect(scanIntegrationSkills(integration)).resolves.toEqual([
      {
        skillIdentity: "diagnose",
        integrationId: "codex",
        state: "enabled",
        provenance: {
          source: null,
          sourceType: null,
          computedHash: null,
        },
        paths: {
          active: skillPath,
          disabled: null,
        },
      },
    ]);
  });

  it("reports a Disabled Skill Installation from the Disabled Skill Store", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const rootPath = join(workspace, "codex");
    const activeSkillsPath = join(rootPath, "skills");
    const disabledSkillsPath = join(rootPath, ".xcode-skills", "disabled");
    const skillPath = join(disabledSkillsPath, "diagnose");

    await mkdir(skillPath, { recursive: true });
    await writeFile(join(skillPath, "SKILL.md"), "# Diagnose\n");

    const integration: IntegrationRoot = {
      id: "codex",
      rootPath,
      activated: true,
      activeSkillsPath,
      disabledSkillsPath,
    };

    await expect(scanIntegrationSkills(integration)).resolves.toEqual([
      {
        skillIdentity: "diagnose",
        integrationId: "codex",
        state: "disabled",
        provenance: {
          source: null,
          sourceType: null,
          computedHash: null,
        },
        paths: {
          active: null,
          disabled: skillPath,
        },
      },
    ]);
  });

  it("reports conflict when active and disabled copies both exist", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const rootPath = join(workspace, "codex");
    const activeSkillsPath = join(rootPath, "skills");
    const disabledSkillsPath = join(rootPath, ".xcode-skills", "disabled");
    const activeSkillPath = join(activeSkillsPath, "diagnose");
    const disabledSkillPath = join(disabledSkillsPath, "diagnose");

    await mkdir(activeSkillPath, { recursive: true });
    await mkdir(disabledSkillPath, { recursive: true });
    await writeFile(join(activeSkillPath, "SKILL.md"), "# Diagnose\n");
    await writeFile(join(disabledSkillPath, "SKILL.md"), "# Diagnose\n");

    const integration: IntegrationRoot = {
      id: "codex",
      rootPath,
      activated: true,
      activeSkillsPath,
      disabledSkillsPath,
    };

    await expect(scanIntegrationSkills(integration)).resolves.toEqual([
      {
        skillIdentity: "diagnose",
        integrationId: "codex",
        state: "conflict",
        provenance: {
          source: null,
          sourceType: null,
          computedHash: null,
        },
        paths: {
          active: activeSkillPath,
          disabled: disabledSkillPath,
        },
      },
    ]);
  });

  it("reports folders without SKILL.md as suspicious", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const rootPath = join(workspace, "codex");
    const activeSkillsPath = join(rootPath, "skills");
    const disabledSkillsPath = join(rootPath, ".xcode-skills", "disabled");
    const skillPath = join(activeSkillsPath, "not-a-skill");

    await mkdir(skillPath, { recursive: true });
    await writeFile(join(skillPath, "README.md"), "# Not a skill\n");

    const integration: IntegrationRoot = {
      id: "codex",
      rootPath,
      activated: true,
      activeSkillsPath,
      disabledSkillsPath,
    };

    await expect(scanIntegrationSkills(integration)).resolves.toEqual([
      {
        skillIdentity: "not-a-skill",
        integrationId: "codex",
        state: "suspicious",
        provenance: {
          source: null,
          sourceType: null,
          computedHash: null,
        },
        paths: {
          active: skillPath,
          disabled: null,
        },
      },
    ]);
  });

  it("ignores dot-prefixed system folders in active and disabled Skill stores", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const rootPath = join(workspace, "ClaudeAgentConfig");
    const activeSkillsPath = join(rootPath, "skills");
    const disabledSkillsPath = join(rootPath, ".xcode-skills", "disabled");
    const skillPath = join(activeSkillsPath, "diagnose");

    await mkdir(join(activeSkillsPath, ".system"), { recursive: true });
    await mkdir(join(activeSkillsPath, ".cache"), { recursive: true });
    await mkdir(join(disabledSkillsPath, ".system"), { recursive: true });
    await mkdir(skillPath, { recursive: true });
    await writeFile(join(activeSkillsPath, ".system", "README.md"), "# System skills\n");
    await writeFile(join(disabledSkillsPath, ".system", "README.md"), "# System skills\n");
    await writeFile(join(skillPath, "SKILL.md"), "# Diagnose\n");

    const integration: IntegrationRoot = {
      id: "claude",
      rootPath,
      activated: true,
      activeSkillsPath,
      disabledSkillsPath,
    };

    await expect(scanIntegrationSkills(integration)).resolves.toEqual([
      {
        skillIdentity: "diagnose",
        integrationId: "claude",
        state: "enabled",
        provenance: {
          source: null,
          sourceType: null,
          computedHash: null,
        },
        paths: {
          active: skillPath,
          disabled: null,
        },
      },
    ]);
  });

  it("reads provenance from a Skill Lock File inside the Skill Folder", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const rootPath = join(workspace, "codex");
    const activeSkillsPath = join(rootPath, "skills");
    const disabledSkillsPath = join(rootPath, ".xcode-skills", "disabled");
    const skillPath = join(activeSkillsPath, "diagnose");

    await mkdir(skillPath, { recursive: true });
    await writeFile(join(skillPath, "SKILL.md"), "# Diagnose\n");
    await writeFile(
      join(skillPath, "skills-lock.json"),
      JSON.stringify({
        version: 1,
        skills: {
          diagnose: {
            source: "mattpocock/skills",
            sourceType: "github",
            computedHash: "15939a26",
          },
        },
      }),
    );

    const integration: IntegrationRoot = {
      id: "codex",
      rootPath,
      activated: true,
      activeSkillsPath,
      disabledSkillsPath,
    };

    await expect(scanIntegrationSkills(integration)).resolves.toEqual([
      {
        skillIdentity: "diagnose",
        integrationId: "codex",
        state: "enabled",
        provenance: {
          source: "mattpocock/skills",
          sourceType: "github",
          computedHash: "15939a26",
        },
        paths: {
          active: skillPath,
          disabled: null,
        },
      },
    ]);
  });
});
