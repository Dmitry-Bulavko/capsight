/**
 * Merge per-platform snapshots into a declared ecosystem inventory.
 * @see docs/tasks/EC-02-multi-platform-scan.md
 */

import type { PlatformId } from "../adapters/platform.js";
import { RESOURCE_CLASS, type ResourceClass } from "../core/compat/resource-class.js";
import type {
  Agent,
  EcosystemInventory,
  InventoryResource,
  InventoryResourceKind,
  OverlapRelation,
  PlatformDetection,
  SourceInfo,
} from "../core/model/index.js";
import type { ScanResult } from "./scan.js";

interface DiscoveredSkillLike {
  id: string;
  name: string;
  source: SourceInfo;
  path: string;
  kind?: "skill" | "command";
}

interface DiscoveredInstructionLike {
  id: string;
  type: string;
  path: string;
  scope: SourceInfo["scope"];
}

interface DiscoveredMcpServerLike {
  id: string;
  name: string;
  source: SourceInfo;
  configPath: string;
  definitionKind: "inline-agent" | "named-reference" | "config-file";
}

function emptyResources(): Record<InventoryResourceKind, InventoryResource[]> {
  return {
    agent: [],
    skill: [],
    mcp_server: [],
    instruction: [],
  };
}

function inventoryId(platform: string, kind: InventoryResourceKind, resourceId: string): string {
  return `${platform}:${kind}:${resourceId}`;
}

function resourceClassForSkill(skill: DiscoveredSkillLike): ResourceClass {
  return skill.kind === "command"
    ? RESOURCE_CLASS.COMMAND_MARKDOWN
    : RESOURCE_CLASS.SKILL_DIRECTORY;
}

function resourceClassForInstruction(instruction: DiscoveredInstructionLike): ResourceClass {
  switch (instruction.type) {
    case "AGENTS.md":
      return RESOURCE_CLASS.INSTRUCTION_AGENTS_MD;
    case "AGENTS.override.md":
      return RESOURCE_CLASS.INSTRUCTION_AGENTS_OVERRIDE_MD;
    case "CLAUDE.md":
      return RESOURCE_CLASS.INSTRUCTION_CLAUDE_MD;
    case "CLAUDE.local.md":
      return RESOURCE_CLASS.INSTRUCTION_CLAUDE_LOCAL_MD;
    case "rule":
      return RESOURCE_CLASS.INSTRUCTION_RULE_MDC;
    case "cursorrules":
      return RESOURCE_CLASS.INSTRUCTION_CURSORRULES;
    case "fallback":
      return RESOURCE_CLASS.INSTRUCTION_FALLBACK_DOC;
    default:
      return RESOURCE_CLASS.INSTRUCTION_AGENTS_MD;
  }
}

function resourceClassForMcp(server: DiscoveredMcpServerLike): ResourceClass {
  if (server.definitionKind === "inline-agent") {
    return RESOURCE_CLASS.MCP_INLINE_AGENT;
  }
  if (server.configPath.endsWith(".toml")) {
    return RESOURCE_CLASS.MCP_TOML_CONFIG;
  }
  return RESOURCE_CLASS.MCP_JSON_CONFIG;
}

function agentResource(platform: string, agent: Agent): InventoryResource {
  return {
    id: inventoryId(platform, "agent", agent.id),
    kind: "agent",
    platform,
    scope: agent.source.scope,
    resourceClass: RESOURCE_CLASS.AGENT_MARKDOWN,
    path: agent.source.path,
    name: agent.name,
  };
}

function skillResource(platform: string, skill: DiscoveredSkillLike): InventoryResource {
  return {
    id: inventoryId(platform, "skill", skill.id),
    kind: "skill",
    platform,
    scope: skill.source.scope,
    resourceClass: resourceClassForSkill(skill),
    path: skill.path,
    name: skill.name,
  };
}

function instructionResource(
  platform: string,
  instruction: DiscoveredInstructionLike,
): InventoryResource {
  return {
    id: inventoryId(platform, "instruction", instruction.id),
    kind: "instruction",
    platform,
    scope: instruction.scope,
    resourceClass: resourceClassForInstruction(instruction),
    path: instruction.path,
    name: instruction.type,
  };
}

function mcpResource(platform: string, server: DiscoveredMcpServerLike): InventoryResource {
  return {
    id: inventoryId(platform, "mcp_server", server.id),
    kind: "mcp_server",
    platform,
    scope: server.source.scope,
    resourceClass: resourceClassForMcp(server),
    path: server.configPath,
    name: server.name,
  };
}

function normalizePathKey(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  return value.replace(/\\/g, "/");
}

function overlapKey(leftId: string, rightId: string): string {
  return leftId < rightId ? `${leftId}\0${rightId}` : `${rightId}\0${leftId}`;
}

function buildOverlapRelations(
  agents: Array<{ resource: InventoryResource; agent: Agent }>,
): OverlapRelation[] {
  const byPath = new Map<string, InventoryResource>();
  for (const { resource } of agents) {
    const key = `${resource.platform}\0${normalizePathKey(resource.path)}`;
    if (resource.path) {
      byPath.set(key, resource);
    }
  }

  const relations = new Map<string, OverlapRelation>();

  for (const { resource, agent } of agents) {
    if (!agent.collision) {
      continue;
    }

    const collision = agent.collision;
    const sourcePath = normalizePathKey(agent.source.path);

    for (const candidate of collision.candidates) {
      const candidatePath = normalizePathKey(candidate.path);
      if (!candidatePath || candidatePath === sourcePath) {
        continue;
      }

      const other = byPath.get(`${resource.platform}\0${candidatePath}`);
      if (!other) {
        continue;
      }

      const key = overlapKey(resource.id, other.id);
      if (relations.has(key)) {
        continue;
      }

      relations.set(key, {
        ids: resource.id < other.id ? [resource.id, other.id] : [other.id, resource.id],
        collision: {
          candidates: collision.candidates,
          ...(collision.effective !== undefined ? { effective: collision.effective } : {}),
          rule: collision.rule,
          ...(collision.matrixRef !== undefined ? { matrixRef: collision.matrixRef } : {}),
          ...(collision.enforcement !== undefined ? { enforcement: collision.enforcement } : {}),
        },
      });
    }
  }

  return [...relations.values()];
}

export interface BuildEcosystemInventoryInput {
  projectPath: string;
  detection: PlatformDetection[];
  scans: Partial<Record<PlatformId, ScanResult>>;
}

export function buildEcosystemInventory(
  input: BuildEcosystemInventoryInput,
): EcosystemInventory {
  const resources = emptyResources();
  const agentPairs: Array<{ resource: InventoryResource; agent: Agent }> = [];

  const detectedPlatforms = new Set(
    input.detection
      .filter((entry) => entry.status === "detected")
      .map((entry) => entry.platform),
  );

  for (const [platform, scan] of Object.entries(input.scans) as Array<
    [PlatformId, ScanResult | undefined]
  >) {
    if (!scan || !detectedPlatforms.has(platform)) {
      continue;
    }

    for (const agent of scan.snapshot.agents) {
      const resource = agentResource(platform, agent);
      resources.agent.push(resource);
      agentPairs.push({ resource, agent });
    }

    for (const skill of scan.snapshot.skills as DiscoveredSkillLike[]) {
      resources.skill.push(skillResource(platform, skill));
    }

    for (const instruction of scan.snapshot.instructions as DiscoveredInstructionLike[]) {
      resources.instruction.push(instructionResource(platform, instruction));
    }

    for (const server of scan.snapshot.mcpServers as DiscoveredMcpServerLike[]) {
      resources.mcp_server.push(mcpResource(platform, server));
    }
  }

  return {
    projectPath: input.projectPath,
    detection: input.detection,
    resources,
    overlaps: buildOverlapRelations(agentPairs),
  };
}
