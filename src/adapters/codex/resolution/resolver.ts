import type {
  EffectiveConfiguration,
  ExecutionContext,
  ResolutionReason,
  ResolvedCapability,
  SourceInfo,
  Warning,
} from "../../../core/model/index.js";
import type {
  CodexAgent as Agent,
  CodexProjectSnapshot as ProjectSnapshot,
} from "../model/index.js";
import { CODEX_PLATFORM } from "../model/index.js";
import { FACT } from "../version/facts.js";
import { gateCapability, gateWarning, MATRIX } from "../version/matrix.js";
import type {
  DiscoveredInstruction,
  DiscoveredMcpServer,
  DiscoveredSkill,
} from "../discovery/types.js";

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

/** @see docs/CODEX-FACTS.md §11 */
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
  const warnings: Warning[] = [];
  const version = snapshot.version.version;
  const instructionGate = gateCapability(MATRIX["instruction.chain"], version);
  const trustGate = gateCapability(MATRIX["trust.project"], version);

  if (snapshot.trust.accepted === "unknown") {
    warnings.push({
      category: "trust",
      severity: "info",
      message: snapshot.trust.unknownReason ?? "Codex project trust state is unknown.",
      evidence: [{ platform: CODEX_PLATFORM, scope: "unknown" }],
      matrixRef: MATRIX["trust.project"],
      enforcement: "unknown",
    });
  } else if (snapshot.trust.accepted === false) {
    warnings.push(
      gateWarning(
        {
          category: "trust",
          severity: "warning",
          message: `Project is untrusted; project .codex/ layers are not loaded (${FACT.XT1}).`,
          evidence: [
            {
              platform: CODEX_PLATFORM,
              scope: "project",
              path: snapshot.trust.projectPath,
            },
          ],
          enforcement: trustGate.enforcement,
        },
        MATRIX["trust.project"],
        version,
      ),
    );
  }

  for (const instruction of snapshot.instructions as DiscoveredInstruction[]) {
    const source = {
      platform: CODEX_PLATFORM,
      scope: instruction.scope,
      path: instruction.path,
    };
    const founded = !instructionGate.unfounded;
    capabilities.push({
      capabilityId: instructionCapabilityId(instruction),
      kind: "instruction",
      status: founded ? "available" : "unknown",
      enforcement: instructionGate.enforcement,
      sources: [source],
      reasons: [
        makeReason(
          founded ? "declared" : "unknown",
          founded
            ? `Instruction "${instruction.type}" is in the effective chain (${FACT.XI5}).`
            : `Instruction "${instruction.type}" application semantics are not verified for Codex (${FACT.XI5}).`,
          source,
          MATRIX["instruction.chain"],
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
          `Skill "${skill.name}" attachment semantics are not verified (${FACT.XS2}).`,
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
          `MCP server "${server.name}" is configured but not probed (${FACT.XM3}).`,
          server.source,
          MATRIX["mcp.probe"],
        ),
      ],
    });
  }

  if (agent.status !== "active") {
    warnings.push({
      category: "advisory",
      severity: "warning",
      message: `Agent "${agent.name}" is not active (${agent.status}).`,
      evidence: [agent.source],
      enforcement: "unknown",
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
  return agents.find((entry) => entry.id === agentId);
}
