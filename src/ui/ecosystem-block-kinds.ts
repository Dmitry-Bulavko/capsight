import type { InventoryResourceKind } from "../core/model/ecosystem.js";
import type { EcosystemBlockKind } from "./ecosystem-layout.js";

export interface EcosystemBlockKindMeta {
  label: string;
  hint: string;
  color: string;
}

export const ECOSYSTEM_BLOCK_KIND_META: Record<EcosystemBlockKind, EcosystemBlockKindMeta> = {
  agent: {
    label: "Agent",
    hint: "Agent definition discovered in project configuration.",
    color: "#8ab4f8",
  },
  skill: {
    label: "Skill",
    hint: "Skill — instructions and optional tool allowances.",
    color: "#c58af9",
  },
  mcp_server: {
    label: "MCP Server",
    hint: "MCP server — external tool provider from project config.",
    color: "#f28b82",
  },
  instruction: {
    label: "Instruction",
    hint: "Instruction source — AGENTS.md, rules, or other context files.",
    color: "#78d9ec",
  },
};

export function ecosystemBlockKindColor(kind: InventoryResourceKind): string {
  return ECOSYSTEM_BLOCK_KIND_META[kind].color;
}

export function formatEcosystemBlockKind(kind: InventoryResourceKind): string {
  return ECOSYSTEM_BLOCK_KIND_META[kind].label;
}

export function ecosystemBlockKindHint(kind: InventoryResourceKind): string {
  return ECOSYSTEM_BLOCK_KIND_META[kind].hint;
}

export function ecosystemKindGlow(color: string): string {
  return `0 0 12px ${color}55, 0 0 28px ${color}22`;
}
