import { scanIntegrationSkills, type ScannedSkillInstallation } from "./filesystem-state.js";
import type { IntegrationRoot } from "./integrations.js";
import { disableSkill, enableSkill, type LifecycleResult } from "./lifecycle.js";
import { uninstallSkill } from "./uninstall.js";

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
  pendingUninstall?: ManageUninstallConfirmation;
};

export type ManageUninstallConfirmation = {
  integrationId: IntegrationRoot["id"];
  skillIdentity: string;
  removedPaths: string[];
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
      const selectedSkillIndex =
        options.activeTabIndex === tabIndex ? (options.selectedSkillIndexes?.[tabIndex] ?? -1) : -1;
      return [
        formattedTitle,
        ...tab.skills.map((skill, skillIndex) => {
          const marker = selectedSkillIndex === skillIndex ? ">" : " ";
          return `${marker} ${skill.skillIdentity}  ${skill.state}`;
        }),
      ].join("\n");
    })
    .join("\n\n");
  const uninstallPrompt =
    options.pendingUninstall === undefined
      ? undefined
      : formatUninstallConfirmation(options.pendingUninstall);
  return [tabOutput, uninstallPrompt, manageControlsHint()].filter(Boolean).join("\n\n");
}

function green(value: string): string {
  return `\x1B[32m${value}\x1B[39m`;
}

function manageControlsHint(): string {
  return "Controls: Tab switch Codex/Claude | Up/Down or k/j move | Space/Enter toggle | u uninstall | q quit";
}

function formatUninstallConfirmation(confirmation: ManageUninstallConfirmation): string {
  return [
    `Uninstall ${confirmation.skillIdentity} from ${displayIntegration(confirmation.integrationId)}?`,
    ...confirmation.removedPaths.map((path) => `  ${path}`),
    "Continue? (y/N)",
  ].join("\n");
}

export async function runManageSession(
  integrations: IntegrationRoot[],
  options: ManageSessionOptions,
): Promise<string> {
  let activeTabIndex = 0;
  const selectedSkillIndexes = integrations.map(() => 0);
  let latestView = await buildManageView(integrations);
  let pendingUninstall: ManageUninstallConfirmation | undefined;
  options.render?.(formatManageView(latestView, { activeTabIndex, selectedSkillIndexes }));

  while (true) {
    const key = await options.readKey();
    if (pendingUninstall !== undefined) {
      if (key === "y" || key === "Y") {
        const integration = integrations[activeTabIndex];
        if (integration !== undefined) {
          await uninstallSkill(integration, pendingUninstall.skillIdentity, { yes: true });
          latestView = await buildManageView(integrations);
          selectedSkillIndexes[activeTabIndex] = Math.min(
            selectedSkillIndexes[activeTabIndex] ?? 0,
            Math.max((latestView[activeTabIndex]?.skills.length ?? 1) - 1, 0),
          );
        }
      }
      pendingUninstall = undefined;
      options.render?.(formatManageView(latestView, { activeTabIndex, selectedSkillIndexes }));
      continue;
    }

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

    if (key === "u") {
      const tab = latestView[activeTabIndex];
      const selectedSkillIndex = selectedSkillIndexes[activeTabIndex] ?? 0;
      const selectedSkill = tab?.skills[selectedSkillIndex];
      const integration = integrations[activeTabIndex];
      if (tab?.activated === true && integration !== undefined && selectedSkill !== undefined) {
        const result = await uninstallSkill(integration, selectedSkill.skillIdentity, {
          dryRun: true,
        });
        if (result.removedPaths.length > 0) {
          pendingUninstall = {
            integrationId: result.integrationId,
            skillIdentity: result.skillIdentity,
            removedPaths: result.removedPaths,
          };
          options.render?.(
            formatManageView(latestView, {
              activeTabIndex,
              selectedSkillIndexes,
              pendingUninstall,
            }),
          );
        }
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

function displayIntegration(id: IntegrationRoot["id"]): string {
  return id === "codex" ? "Codex" : "Claude";
}
