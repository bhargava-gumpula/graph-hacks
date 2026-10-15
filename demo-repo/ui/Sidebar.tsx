import { health, healthLine } from "../api/health";
import { gateFor, gateLabel } from "../auth/policy";

export function renderSidebar(roleName: string, epoch: string): string {
  const report = health(epoch);
  const gate = gateFor(roleName);
  return healthLine(report) + " " + gateLabel(gate);
}

export function sidebarLabel(): string {
  return "Menu";
}
