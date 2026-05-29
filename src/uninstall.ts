import { join } from "node:path";

import { pathExists, removePath } from "./fs-utils.js";
import type { IntegrationRoot } from "./integrations.js";

export type UninstallStatus =
  | "uninstalled"
  | "not-installed"
  | "not-activated"
  | "needs-confirmation"
  | "would-uninstall";

export type UninstallResult = {
  integrationId: IntegrationRoot["id"];
  skillIdentity: string;
  status: UninstallStatus;
  removedPaths: string[];
};

export async function uninstallSkill(
  integration: IntegrationRoot,
  skillIdentity: string,
  options: { dryRun?: boolean; yes?: boolean } = {},
): Promise<UninstallResult> {
  if (!integration.activated) {
    return {
      integrationId: integration.id,
      skillIdentity,
      status: "not-activated",
      removedPaths: [],
    };
  }

  const activePath = join(integration.activeSkillsPath, skillIdentity);
  const disabledPath = join(integration.disabledSkillsPath, skillIdentity);
  const paths = [
    ...(await pathExists(activePath) ? [activePath] : []),
    ...(await pathExists(disabledPath) ? [disabledPath] : []),
  ];

  if (paths.length === 0) {
    return {
      integrationId: integration.id,
      skillIdentity,
      status: "not-installed",
      removedPaths: [],
    };
  }

  if (options.dryRun === true) {
    return {
      integrationId: integration.id,
      skillIdentity,
      status: "would-uninstall",
      removedPaths: paths,
    };
  }

  if (options.yes !== true && (await requiresConfirmation(paths))) {
    return {
      integrationId: integration.id,
      skillIdentity,
      status: "needs-confirmation",
      removedPaths: paths,
    };
  }

  await Promise.all(paths.map((path) => removePath(path)));

  return {
    integrationId: integration.id,
    skillIdentity,
    status: "uninstalled",
    removedPaths: paths,
  };
}

async function requiresConfirmation(paths: string[]): Promise<boolean> {
  for (const path of paths) {
    if (
      !(await pathExists(join(path, "skills-lock.json"))) ||
      !(await pathExists(join(path, "SKILL.md")))
    ) {
      return true;
    }
  }

  return false;
}
