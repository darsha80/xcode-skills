import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { copyDirectoryReplacing, removePath } from "./fs-utils.js";
import type { IntegrationRoot } from "./integrations.js";

export type ResolvedSkillArtifact = {
  skillIdentity: string;
  artifactPath: string;
};

export type SkillArtifactResolver = (
  skillSpec: string,
) => Promise<ResolvedSkillArtifact>;

export type InstallStatus = "installed" | "not-activated";

export type InstallResult = {
  integrationId: IntegrationRoot["id"];
  skillIdentity: string;
  status: InstallStatus;
};

export async function installSkill(options: {
  skillSpec: string;
  integrations: IntegrationRoot[];
  resolver: SkillArtifactResolver;
}): Promise<InstallResult[]> {
  const artifact = await options.resolver(options.skillSpec);
  const results: InstallResult[] = [];

  for (const integration of options.integrations) {
    if (!integration.activated) {
      results.push({
        integrationId: integration.id,
        skillIdentity: artifact.skillIdentity,
        status: "not-activated",
      });
      continue;
    }

    const activePath = join(integration.activeSkillsPath, artifact.skillIdentity);
    const disabledPath = join(integration.disabledSkillsPath, artifact.skillIdentity);

    await mkdir(integration.activeSkillsPath, { recursive: true });
    await copyDirectoryReplacing(artifact.artifactPath, activePath);
    await removePath(disabledPath);

    results.push({
      integrationId: integration.id,
      skillIdentity: artifact.skillIdentity,
      status: "installed",
    });
  }

  return results;
}
