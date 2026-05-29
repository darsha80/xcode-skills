import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

import type { IntegrationRoot } from "../src/integrations.js";
import { formatListHuman, formatListJson, listSkillInstallations } from "../src/list.js";

describe("listSkillInstallations", () => {
  it("lists Filesystem State from activated integrations and skips inactive integrations by default", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const codex = integration("codex", join(workspace, "codex"), true);
    const claude = integration("claude", join(workspace, "claude"), false);
    await mkdir(join(codex.activeSkillsPath, "diagnose"), { recursive: true });
    await writeFile(join(codex.activeSkillsPath, "diagnose", "SKILL.md"), "# Diagnose\n");

    const entries = await listSkillInstallations([codex, claude]);

    expect(entries).toEqual([
      expect.objectContaining({
        integrationId: "codex",
        skillIdentity: "diagnose",
        state: "enabled",
      }),
    ]);
  });

  it("filters read-only list output by target when requested", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const codex = integration("codex", join(workspace, "codex"), true);
    const claude = integration("claude", join(workspace, "claude"), true);
    await mkdir(join(codex.activeSkillsPath, "diagnose"), { recursive: true });
    await mkdir(join(claude.activeSkillsPath, "handoff"), { recursive: true });
    await writeFile(join(codex.activeSkillsPath, "diagnose", "SKILL.md"), "# Diagnose\n");
    await writeFile(join(claude.activeSkillsPath, "handoff", "SKILL.md"), "# Handoff\n");

    const entries = await listSkillInstallations([codex, claude], { target: "claude" });

    expect(entries.map((entry) => entry.skillIdentity)).toEqual(["handoff"]);
  });

  it("formats list results as machine-readable JSON", async () => {
    expect(
      formatListJson([
        {
          integrationId: "codex",
          skillIdentity: "diagnose",
          state: "enabled",
          provenance: {
            source: null,
            sourceType: null,
            computedHash: null,
          },
          paths: {
            active: "/tmp/codex/skills/diagnose",
            disabled: null,
          },
        },
      ]),
    ).toBe(
      JSON.stringify(
        [
          {
            integrationId: "codex",
            skillIdentity: "diagnose",
            state: "enabled",
            provenance: {
              source: null,
              sourceType: null,
              computedHash: null,
            },
            paths: {
              active: "/tmp/codex/skills/diagnose",
              disabled: null,
            },
          },
        ],
        null,
        2,
      ),
    );
  });

  it("formats list results for humans", () => {
    expect(
      formatListHuman([
        {
          integrationId: "codex",
          skillIdentity: "diagnose",
          state: "enabled",
          provenance: {
            source: "mattpocock/skills",
            sourceType: "github",
            computedHash: "15939a26abcdef",
          },
          paths: {
            active: "/tmp/codex/skills/diagnose",
            disabled: null,
          },
        },
      ]),
    ).toBe("Codex\n  diagnose  enabled  github:mattpocock/skills  15939a26");
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
