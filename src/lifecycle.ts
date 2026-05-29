import { mkdir, rename, stat } from "node:fs/promises";
import { join } from "node:path";

import type { IntegrationRoot } from "./integrations.js";

export type LifecycleStatus =
  | "enabled"
  | "disabled"
  | "already-enabled"
  | "already-disabled"
  | "not-installed"
  | "conflict";

export type LifecycleResult = {
  integrationId: IntegrationRoot["id"];
  skillIdentity: string;
  status: LifecycleStatus;
};

export async function disableSkill(
  integration: IntegrationRoot,
  skillIdentity: string,
): Promise<LifecycleResult> {
  const activePath = join(integration.activeSkillsPath, skillIdentity);
  const disabledPath = join(integration.disabledSkillsPath, skillIdentity);
  const activeExists = await pathExists(activePath);
  const disabledExists = await pathExists(disabledPath);

  if (activeExists && disabledExists) {
    return {
      integrationId: integration.id,
      skillIdentity,
      status: "conflict",
    };
  }

  if (!activeExists && disabledExists) {
    return {
      integrationId: integration.id,
      skillIdentity,
      status: "already-disabled",
    };
  }

  if (!activeExists) {
    return {
      integrationId: integration.id,
      skillIdentity,
      status: "not-installed",
    };
  }

  await mkdir(integration.disabledSkillsPath, { recursive: true });
  await rename(activePath, disabledPath);

  return {
    integrationId: integration.id,
    skillIdentity,
    status: "disabled",
  };
}

export async function enableSkill(
  integration: IntegrationRoot,
  skillIdentity: string,
): Promise<LifecycleResult> {
  const activePath = join(integration.activeSkillsPath, skillIdentity);
  const disabledPath = join(integration.disabledSkillsPath, skillIdentity);
  const activeExists = await pathExists(activePath);
  const disabledExists = await pathExists(disabledPath);

  if (activeExists && disabledExists) {
    return {
      integrationId: integration.id,
      skillIdentity,
      status: "conflict",
    };
  }

  if (activeExists) {
    return {
      integrationId: integration.id,
      skillIdentity,
      status: "already-enabled",
    };
  }

  if (!disabledExists) {
    return {
      integrationId: integration.id,
      skillIdentity,
      status: "not-installed",
    };
  }

  await mkdir(integration.activeSkillsPath, { recursive: true });
  await rename(disabledPath, activePath);

  return {
    integrationId: integration.id,
    skillIdentity,
    status: "enabled",
  };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
