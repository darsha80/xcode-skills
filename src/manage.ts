import { scanIntegrationSkills, type ScannedSkillInstallation } from "./filesystem-state.js";
import type { IntegrationRoot } from "./integrations.js";
import { disableSkill, enableSkill, type LifecycleResult } from "./lifecycle.js";

export type ManageTab = {
  integrationId: IntegrationRoot["id"];
  activated: boolean;
  skills: ScannedSkillInstallation[];
};

export async function buildManageView(integrations: IntegrationRoot[]): Promise<ManageTab[]> {
  return Promise.all(
    integrations.map(async (integration) => ({
      integrationId: integration.id,
      activated: integration.activated,
      skills: integration.activated ? await scanIntegrationSkills(integration) : [],
    })),
  );
}

export async function toggleManagedSkill(
  integration: IntegrationRoot,
  skillIdentity: string,
): Promise<LifecycleResult> {
  const [current] = (await scanIntegrationSkills(integration)).filter(
    (skill) => skill.skillIdentity === skillIdentity,
  );

  if (current?.state === "enabled") {
    return disableSkill(integration, skillIdentity);
  }

  if (current?.state === "disabled") {
    return enableSkill(integration, skillIdentity);
  }

  return {
    integrationId: integration.id,
    skillIdentity,
    status: current?.state ?? "not-installed",
  };
}
