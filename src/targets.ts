import type { AgentIntegrationId, IntegrationRoot } from "./integrations.js";

export type TargetSelection = AgentIntegrationId | "both";

export type PromptForTarget = () => Promise<TargetSelection>;

export async function selectTargetIntegrations(_options: {
  integrations: IntegrationRoot[];
  target?: TargetSelection;
  promptForTarget?: PromptForTarget;
}): Promise<IntegrationRoot[]> {
  const target =
    _options.target ??
    (await (_options.promptForTarget ?? missingPromptForTarget)());

  if (target === "both") {
    return orderTargets(_options.integrations);
  }

  const integration = _options.integrations.find((item) => item.id === target);
  if (integration === undefined) {
    throw new Error(`Unknown Target Agent Integration: ${target}`);
  }

  if (!integration.activated) {
    throw new Error(`${target} Agent Integration is not activated in Xcode`);
  }

  return [integration];
}

async function missingPromptForTarget(): Promise<TargetSelection> {
  throw new Error("Target Agent Integration is required");
}

function orderTargets(integrations: IntegrationRoot[]): IntegrationRoot[] {
  const order: Record<AgentIntegrationId, number> = { codex: 0, claude: 1 };
  return [...integrations].sort((left, right) => order[left.id] - order[right.id]);
}
