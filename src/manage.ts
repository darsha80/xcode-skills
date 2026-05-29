import { scanIntegrationSkills, type ScannedSkillInstallation } from "./filesystem-state.js";
import type { IntegrationRoot } from "./integrations.js";
import { disableSkill, enableSkill, type LifecycleResult } from "./lifecycle.js";

export type ManageTab = {
  integrationId: IntegrationRoot["id"];
  activated: boolean;
  skills: ScannedSkillInstallation[];
};

export type ManageSessionOptions = {
  readKey: () => Promise<string>;
  render?: (screen: string) => void;
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

export function formatManageView(tabs: ManageTab[]): string {
  return tabs
    .map((tab) => {
      const title = tab.integrationId === "codex" ? "Codex" : "Claude";
      if (!tab.activated) {
        return `${title}\n  not activated in Xcode`;
      }
      if (tab.skills.length === 0) {
        return `${title}\n  no skills`;
      }
      return [
        title,
        ...tab.skills.map((skill) => `  ${skill.skillIdentity}  ${skill.state}`),
      ].join("\n");
    })
    .join("\n\n");
}

export async function runManageSession(
  integrations: IntegrationRoot[],
  options: ManageSessionOptions,
): Promise<string> {
  let activeTabIndex = 0;
  let latestView = await buildManageView(integrations);
  options.render?.(formatManageView(latestView));

  while (true) {
    const key = await options.readKey();
    if (key === "q") {
      return formatManageView(latestView);
    }

    if (key === "Tab" || key === "\t") {
      activeTabIndex = (activeTabIndex + 1) % Math.max(latestView.length, 1);
      continue;
    }

    if (key === " " || key === "Enter" || key === "\r") {
      const tab = latestView[activeTabIndex];
      const firstSkill = tab?.skills[0];
      const integration = integrations[activeTabIndex];
      if (
        tab?.activated === true &&
        integration !== undefined &&
        firstSkill !== undefined &&
        (firstSkill.state === "enabled" || firstSkill.state === "disabled")
      ) {
        await toggleManagedSkill(integration, firstSkill.skillIdentity);
        latestView = await buildManageView(integrations);
        options.render?.(formatManageView(latestView));
      }
    }
  }
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
