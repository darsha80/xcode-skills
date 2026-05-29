import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export type AgentIntegrationId = "codex" | "claude";

export type IntegrationRoot = {
  id: AgentIntegrationId;
  rootPath: string;
  activated: boolean;
  activeSkillsPath: string;
  disabledSkillsPath: string;
};

export type ResolveIntegrationRootsOptions = {
  homeDir?: string;
  roots?: Partial<Record<AgentIntegrationId, string>>;
};

const integrationOrder: AgentIntegrationId[] = ["codex", "claude"];

function defaultRootFor(id: AgentIntegrationId, homeDir: string): string {
  const codingAssistantRoot = join(
    homeDir,
    "Library",
    "Developer",
    "Xcode",
    "CodingAssistant",
  );

  if (id === "codex") {
    return join(codingAssistantRoot, "codex");
  }

  return join(codingAssistantRoot, "ClaudeAgentConfig");
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function resolveIntegrationRoots(
  options: ResolveIntegrationRootsOptions = {},
): Promise<IntegrationRoot[]> {
  const home = options.homeDir ?? homedir();

  return Promise.all(
    integrationOrder.map(async (id): Promise<IntegrationRoot> => {
      const rootPath = options.roots?.[id] ?? defaultRootFor(id, home);

      return {
        id,
        rootPath,
        activated: await pathExists(rootPath),
        activeSkillsPath: join(rootPath, "skills"),
        disabledSkillsPath: join(rootPath, ".xcode-skills", "disabled"),
      };
    }),
  );
}
