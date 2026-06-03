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

export type ManageViewFormatOptions = {
  activeTabIndex?: number;
  selectedSkillIndexes?: number[];
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

export function formatManageView(
  tabs: ManageTab[],
  options: ManageViewFormatOptions = {},
): string {
  const tabOutput = tabs
    .map((tab, tabIndex) => {
      const title = tab.integrationId === "codex" ? "Codex" : "Claude";
      const formattedTitle = options.activeTabIndex === tabIndex ? green(title) : title;
      if (!tab.activated) {
        return `${formattedTitle}\n  not activated in Xcode`;
      }
      if (tab.skills.length === 0) {
        return `${formattedTitle}\n  no skills`;
      }
      const selectedSkillIndex = options.selectedSkillIndexes?.[tabIndex] ?? -1;
      return [
        formattedTitle,
        ...tab.skills.map((skill, skillIndex) => {
          const marker = selectedSkillIndex === skillIndex ? ">" : " ";
          return `${marker} ${skill.skillIdentity}  ${skill.state}`;
        }),
      ].join("\n");
    })
    .join("\n\n");
  return [tabOutput, manageControlsHint()].join("\n\n");
}

function green(value: string): string {
  return `\x1B[32m${value}\x1B[39m`;
}

function manageControlsHint(): string {
  return "Controls: Tab switch Codex/Claude | Up/Down or k/j move | Space/Enter toggle | q quit";
}

export async function runManageSession(
  integrations: IntegrationRoot[],
  options: ManageSessionOptions,
): Promise<string> {
  let activeTabIndex = 0;
  const selectedSkillIndexes = integrations.map(() => 0);
  let latestView = await buildManageView(integrations);
  options.render?.(formatManageView(latestView, { activeTabIndex, selectedSkillIndexes }));

  while (true) {
    const key = await options.readKey();
    if (key === "q") {
      return formatManageView(latestView);
    }

    if (key === "Tab" || key === "\t") {
      activeTabIndex = (activeTabIndex + 1) % Math.max(latestView.length, 1);
      options.render?.(formatManageView(latestView, { activeTabIndex, selectedSkillIndexes }));
      continue;
    }

    if (key === "ArrowDown" || key === "\u001B[B" || key === "j") {
      const skillCount = latestView[activeTabIndex]?.skills.length ?? 0;
      if (skillCount > 0) {
        selectedSkillIndexes[activeTabIndex] =
          ((selectedSkillIndexes[activeTabIndex] ?? 0) + 1) % skillCount;
        options.render?.(formatManageView(latestView, { activeTabIndex, selectedSkillIndexes }));
      }
      continue;
    }

    if (key === "ArrowUp" || key === "\u001B[A" || key === "k") {
      const skillCount = latestView[activeTabIndex]?.skills.length ?? 0;
      if (skillCount > 0) {
        selectedSkillIndexes[activeTabIndex] =
          ((selectedSkillIndexes[activeTabIndex] ?? 0) - 1 + skillCount) % skillCount;
        options.render?.(formatManageView(latestView, { activeTabIndex, selectedSkillIndexes }));
      }
      continue;
    }

    if (key === " " || key === "Enter" || key === "\r") {
      const tab = latestView[activeTabIndex];
      const selectedSkillIndex = selectedSkillIndexes[activeTabIndex] ?? 0;
      const selectedSkill = tab?.skills[selectedSkillIndex];
      const integration = integrations[activeTabIndex];
      if (
        tab?.activated === true &&
        integration !== undefined &&
        selectedSkill !== undefined &&
        (selectedSkill.state === "enabled" || selectedSkill.state === "disabled")
      ) {
        await toggleManagedSkill(integration, selectedSkill.skillIdentity);
        latestView = await buildManageView(integrations);
        selectedSkillIndexes[activeTabIndex] = Math.min(
          selectedSkillIndex,
          Math.max((latestView[activeTabIndex]?.skills.length ?? 1) - 1, 0),
        );
        options.render?.(formatManageView(latestView, { activeTabIndex, selectedSkillIndexes }));
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
