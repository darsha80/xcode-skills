import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { IntegrationRoot } from "../src/integrations.js";
import { selectTargetIntegrations } from "../src/targets.js";

describe("selectTargetIntegrations", () => {
  it("returns both integrations for explicit both even when one is not activated", async () => {
    const result = await selectTargetIntegrations({
      integrations: [
        integration("codex", true),
        integration("claude", false),
      ],
      target: "both",
    });

    expect(result.map((item) => item.id)).toEqual(["codex", "claude"]);
  });

  it("fails when a single explicit target is not activated", async () => {
    await expect(
      selectTargetIntegrations({
        integrations: [
          integration("codex", true),
          integration("claude", false),
        ],
        target: "claude",
      }),
    ).rejects.toThrow(/not activated/i);
  });

  it("prompts for a target when write commands omit target", async () => {
    const result = await selectTargetIntegrations({
      integrations: [
        integration("codex", true),
        integration("claude", true),
      ],
      promptForTarget: async () => "codex",
    });

    expect(result.map((item) => item.id)).toEqual(["codex"]);
  });
});

function integration(id: IntegrationRoot["id"], activated: boolean): IntegrationRoot {
  const rootPath = join("/tmp", id);
  return {
    id,
    rootPath,
    activated,
    activeSkillsPath: join(rootPath, "skills"),
    disabledSkillsPath: join(rootPath, ".xcode-skills", "disabled"),
  };
}
