import { scanIntegrationSkills, type ScannedSkillInstallation } from "./filesystem-state.js";
import type { IntegrationRoot } from "./integrations.js";
import type { TargetSelection } from "./targets.js";

export async function listSkillInstallations(
  integrations: IntegrationRoot[],
  options: { target?: TargetSelection } = {},
): Promise<ScannedSkillInstallation[]> {
  const filteredIntegrations = integrations.filter((integration) => {
    if (options.target === undefined || options.target === "both") {
      return true;
    }

    return integration.id === options.target;
  });
  const activatedIntegrations = filteredIntegrations.filter((integration) => integration.activated);
  const entries = await Promise.all(
    activatedIntegrations.map((integration) => scanIntegrationSkills(integration)),
  );

  return entries.flat().sort((left, right) => {
    const integrationCompare = left.integrationId.localeCompare(right.integrationId);
    return integrationCompare === 0
      ? left.skillIdentity.localeCompare(right.skillIdentity)
      : integrationCompare;
  });
}

export function formatListJson(entries: ScannedSkillInstallation[]): string {
  return JSON.stringify(entries, null, 2);
}

export function formatListHuman(entries: ScannedSkillInstallation[]): string {
  if (entries.length === 0) {
    return "No Xcode Skill Installations found.";
  }

  const grouped = new Map<IntegrationRoot["id"], ScannedSkillInstallation[]>();
  for (const entry of entries) {
    grouped.set(entry.integrationId, [...(grouped.get(entry.integrationId) ?? []), entry]);
  }

  const sections = [...grouped.entries()].map(([integrationId, integrationEntries]) => {
    const title = integrationId === "codex" ? "Codex" : "Claude";
    const rows = integrationEntries.map((entry) => {
      const source =
        entry.provenance.source === null
          ? "unknown"
          : `${entry.provenance.sourceType ?? "source"}:${entry.provenance.source}`;
      const hash =
        entry.provenance.computedHash === null
          ? ""
          : `  ${entry.provenance.computedHash.slice(0, 8)}`;
      return `  ${entry.skillIdentity}  ${entry.state}  ${source}${hash}`;
    });
    return [title, ...rows].join("\n");
  });

  return sections.join("\n\n");
}
