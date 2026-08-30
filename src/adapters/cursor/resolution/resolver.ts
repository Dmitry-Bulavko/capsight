import type {
  EffectiveConfiguration,
  ExecutionContext,
  ResolutionReason,
  ResolvedCapability,
  SourceInfo,
  Warning,
} from "../../../core/model/index.js";
import type {
  CursorAgent as Agent,
  CursorProjectSnapshot as ProjectSnapshot,
} from "../model/index.js";
import { CURSOR_PLATFORM } from "../model/index.js";
import { FACT } from "../version/facts.js";
import { gateCapability, gateCollision, gateDiscovery, MATRIX } from "../version/matrix.js";
import type { DiscoveredInstruction, DiscoveredMcpServer, DiscoveredSkill } from "../discovery/types.js";

export class AgentNotFoundError extends Error {
  constructor(agentId: string) {
    super(`Agent not found: ${agentId}`);
    this.name = "AgentNotFoundError";
  }
}

function makeReason(
  type: ResolutionReason["type"],
  message: string,
  source?: SourceInfo,
  matrixRef?: string,
): ResolutionReason {
  return matrixRef
    ? { type, message, source, matrixRef }
    : source
      ? { type, message, source }
      : { type, message };
}

function instructionCapabilityId(instruction: DiscoveredInstruction): string {
  const base = instruction.path.split(/[/\\]/).pop() ?? instruction.path;
  return `instruction:${instruction.type}:${base}`;
}

function computeUnknownRate(capabilities: ResolvedCapability[]): number {
  if (capabilities.length === 0) {
    return 0;
  }
  const unknownCount = capabilities.filter((cap) => cap.status === "unknown").length;
  return unknownCount / capabilities.length;
}

/** @see docs/CURSOR-FACTS.md §10 */
export async function resolveEffectiveConfiguration(
  snapshot: ProjectSnapshot,
  agentId: string,
  context: ExecutionContext,
): Promise<EffectiveConfiguration> {
  const agent = snapshot.agents.find((entry) => entry.id === agentId);
  if (!agent) {
    throw new AgentNotFoundError(agentId);
  }

  const capabilities: ResolvedCapability[] = [];
  const warnings: Warning[] = [...snapshot.warnings];
  const toolGate = gateCapability(MATRIX["agent.toolPool"]);

  if (snapshot.trust.accepted === "unknown") {
    warnings.push({
      category: "trust",
      severity: "info",
      message: snapshot.trust.unknownReason ?? "Cursor project trust state is unknown.",
      evidence: [{ platform: CURSOR_PLATFORM, scope: "unknown" }],
      matrixRef: MATRIX["trust.project"],
      enforcement: "unknown",
    });
  }

  for (const tool of agent.configuration.tools ?? []) {
    capabilities.push({
      capabilityId: tool,
      kind: "tool",
      status: "unknown",
      enforcement: toolGate.enforcement,
      sources: [agent.source],
      reasons: [
        makeReason(
          "unknown",
          "Cursor subagent tool pool semantics are not verified (CA4).",
          agent.source,
          MATRIX["agent.toolPool"],
        ),
      ],
    });
  }

  for (const instruction of snapshot.instructions as DiscoveredInstruction[]) {
    capabilities.push({
      capabilityId: instructionCapabilityId(instruction),
      kind: "instruction",
      status: "unknown",
      enforcement: "unknown",
      sources: [
        {
          platform: CURSOR_PLATFORM,
          scope: instruction.scope,
          path: instruction.path,
        },
      ],
      reasons: [
        makeReason(
          "unknown",
          `Instruction "${instruction.type}" application semantics are not verified for Cursor.`,
          {
            platform: CURSOR_PLATFORM,
            scope: instruction.scope,
            path: instruction.path,
          },
        ),
      ],
    });
  }

  for (const skill of snapshot.skills as DiscoveredSkill[]) {
    capabilities.push({
      capabilityId: `skill:${skill.name}`,
      kind: "skill",
      status: "unknown",
      enforcement: "unknown",
      sources: [skill.source],
      reasons: [
        makeReason(
          "unknown",
          `Skill "${skill.name}" (${skill.kind}) attachment semantics are not verified (CS2).`,
          skill.source,
        ),
      ],
    });
  }

  for (const server of snapshot.mcpServers as DiscoveredMcpServer[]) {
    capabilities.push({
      capabilityId: `mcp:${server.name}`,
      kind: "mcp_server",
      status: "unknown",
      enforcement: "unknown",
      sources: [server.source],
      reasons: [
        makeReason(
          "not-probed",
          `MCP server "${server.name}" is configured but not probed (CM4).`,
          server.source,
        ),
      ],
    });
  }

  if (agent.status === "ambiguous") {
    warnings.push({
      category: "ambiguous-collision",
      severity: "warning",
      message: `Agent "${agent.name}" has a same-scope name collision; effective file is unknown (${FACT.CA3}).`,
      evidence: agent.collision?.candidates ?? [agent.source],
      matrixRef: MATRIX["collision.sameDir"],
      enforcement: agent.collision?.enforcement ?? "unknown",
    });
  }

  if (agent.status === "shadowed") {
    warnings.push({
      category: "shadowing",
      severity: "info",
      message: `Agent "${agent.name}" is shadowed by another declaration (${FACT.CW4}).`,
      evidence: agent.collision?.candidates ?? [agent.source],
      matrixRef: MATRIX["collision.sameDir"],
      enforcement: agent.collision?.enforcement ?? "unknown",
    });
  }

  return {
    agentId,
    context,
    version: snapshot.version,
    capabilities,
    warnings,
    unknownRate: computeUnknownRate(capabilities),
  };
}

export function findAgentById(agents: readonly Agent[], agentId: string): Agent | undefined {
  return agents.find((agent) => agent.id === agentId);
}
