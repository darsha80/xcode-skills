import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

import type { IntegrationRoot } from "./integrations.js";

export type SkillInstallationState = "enabled" | "disabled" | "conflict" | "suspicious";

export type SkillProvenance = {
  source: string | null;
  sourceType: string | null;
  computedHash: string | null;
};

export type ScannedSkillInstallation = {
  skillIdentity: string;
  integrationId: IntegrationRoot["id"];
  state: SkillInstallationState;
  provenance: SkillProvenance;
  paths: {
    active: string | null;
    disabled: string | null;
  };
};

export async function scanIntegrationSkills(
  integration: IntegrationRoot,
): Promise<ScannedSkillInstallation[]> {
  if (!integration.activated) {
    return [];
  }

  const activeEntries = await readSkillDirectories(integration.activeSkillsPath);
  const disabledEntries = await readSkillDirectories(integration.disabledSkillsPath);
  const skillIdentities = [...new Set([...activeEntries, ...disabledEntries])].sort();

  return Promise.all(skillIdentities.map(async (skillIdentity) => {
    const active = activeEntries.includes(skillIdentity);
    const disabled = disabledEntries.includes(skillIdentity);
    const activePath = active ? join(integration.activeSkillsPath, skillIdentity) : null;
    const disabledPath = disabled
      ? join(integration.disabledSkillsPath, skillIdentity)
      : null;
    const hasSkillFile = await hasRootSkillFile(activePath ?? disabledPath);
    const state = !hasSkillFile
      ? "suspicious"
      : active && disabled
        ? "conflict"
        : active
          ? "enabled"
          : "disabled";

    return {
      skillIdentity,
      integrationId: integration.id,
      state,
      provenance: await readProvenance(skillIdentity, activePath ?? disabledPath),
      paths: {
        active: activePath,
        disabled: disabledPath,
      },
    };
  }));
}

async function readSkillDirectories(path: string): Promise<string[]> {
  let entries: string[];

  try {
    entries = await readdir(path);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const directories = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = join(path, entry);
      const entryStat = await stat(entryPath);
      return entryStat.isDirectory() ? entry : null;
    }),
  );

  return directories.filter((entry): entry is string => entry !== null).sort();
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

async function hasRootSkillFile(skillPath: string | null): Promise<boolean> {
  if (skillPath === null) {
    return false;
  }

  try {
    const skillFile = await stat(join(skillPath, "SKILL.md"));
    return skillFile.isFile();
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

async function readProvenance(
  skillIdentity: string,
  skillPath: string | null,
): Promise<SkillProvenance> {
  const unknown = {
    source: null,
    sourceType: null,
    computedHash: null,
  };

  if (skillPath === null) {
    return unknown;
  }

  let rawLockFile: string;

  try {
    rawLockFile = await readFile(join(skillPath, "skills-lock.json"), "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return unknown;
    }

    throw error;
  }

  const parsed = JSON.parse(rawLockFile) as {
    skills?: Record<
      string,
      {
        source?: unknown;
        sourceType?: unknown;
        computedHash?: unknown;
      }
    >;
  };
  const entry = parsed.skills?.[skillIdentity];

  return {
    source: typeof entry?.source === "string" ? entry.source : null,
    sourceType: typeof entry?.sourceType === "string" ? entry.sourceType : null,
    computedHash:
      typeof entry?.computedHash === "string" ? entry.computedHash : null,
  };
}
