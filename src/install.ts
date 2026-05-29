import { mkdir, stat } from "node:fs/promises";
import { join } from "node:path";

import { copyDirectoryReplacing, pathExists, removePath } from "./fs-utils.js";
import type { IntegrationRoot } from "./integrations.js";

export type ResolvedSkillArtifact = {
  skillIdentity: string;
  artifactPath: string;
  cleanup?: () => Promise<void>;
};

export type SkillArtifactResolver = (
  skillSpec: string,
) => Promise<ResolvedSkillArtifact>;

export type InstallStatus =
  | "installed"
  | "would-install"
  | "not-activated"
  | "needs-confirmation";

export type InstallResult = {
  integrationId: IntegrationRoot["id"];
  skillIdentity: string;
  status: InstallStatus;
};

export async function installSkill(options: {
  skillSpec: string;
  integrations: IntegrationRoot[];
  resolver: SkillArtifactResolver;
  dryRun?: boolean;
  yes?: boolean;
}): Promise<InstallResult[]> {
  const artifact = await options.resolver(options.skillSpec);
  try {
    await validateArtifact(artifact);
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

      if (
        options.dryRun !== true &&
        options.yes !== true &&
        (await pathExists(activePath)) &&
        !(await pathExists(join(activePath, "skills-lock.json")))
      ) {
        results.push({
          integrationId: integration.id,
          skillIdentity: artifact.skillIdentity,
          status: "needs-confirmation",
        });
        continue;
      }

      if (options.dryRun === true) {
        results.push({
          integrationId: integration.id,
          skillIdentity: artifact.skillIdentity,
          status: "would-install",
        });
        continue;
      }

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
  } finally {
    await artifact.cleanup?.();
  }
}

async function validateArtifact(artifact: ResolvedSkillArtifact): Promise<void> {
  const artifactStat = await stat(artifact.artifactPath);
  if (!artifactStat.isDirectory()) {
    throw new Error(`Resolved Skill Artifact is not a directory: ${artifact.artifactPath}`);
  }

  try {
    const skillFile = await stat(join(artifact.artifactPath, "SKILL.md"));
    if (!skillFile.isFile()) {
      throw new Error(`Resolved Skill Artifact is missing root SKILL.md: ${artifact.artifactPath}`);
    }
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      throw new Error(`Resolved Skill Artifact is missing root SKILL.md: ${artifact.artifactPath}`);
    }

    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
