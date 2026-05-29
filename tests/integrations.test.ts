import { mkdir, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

import { resolveIntegrationRoots } from "../src/integrations.js";

describe("resolveIntegrationRoots", () => {
  it("reports activation from integration root existence without creating missing roots", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "xcode-skills-"));
    const codexRoot = join(workspace, "codex");
    const claudeRoot = join(workspace, "ClaudeAgentConfig");

    await mkdir(codexRoot, { recursive: true });

    const roots = await resolveIntegrationRoots({
      roots: {
        codex: codexRoot,
        claude: claudeRoot,
      },
    });

    expect(roots).toEqual([
      {
        id: "codex",
        rootPath: codexRoot,
        activated: true,
        activeSkillsPath: join(codexRoot, "skills"),
        disabledSkillsPath: join(codexRoot, ".xcode-skills", "disabled"),
      },
      {
        id: "claude",
        rootPath: claudeRoot,
        activated: false,
        activeSkillsPath: join(claudeRoot, "skills"),
        disabledSkillsPath: join(claudeRoot, ".xcode-skills", "disabled"),
      },
    ]);
  });
});
