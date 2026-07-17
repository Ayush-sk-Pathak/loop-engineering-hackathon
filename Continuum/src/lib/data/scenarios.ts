import { WORKSPACE_LIST } from "./workspaces";
import type { Scenario } from "../types";

export const SCENARIOS = WORKSPACE_LIST.map((workspace) => workspace.scenario);

export function getScenario(id: string): Scenario {
  const found = SCENARIOS.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown scenario: ${id}`);
  return found;
}
