import fs from "node:fs/promises";
import type {
  Agent,
  ExecutionContext,
  ProjectSnapshot,
  ResolutionReason,
  ResolvedCapability,
  SourceInfo,
} from "../../../core/model/index.js";
import type { DiscoveredSkill } from "../discovery/types.js";
import { parseFrontmatter } from "../parsing/frontmatter.js";

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

function fieldSource(agent: Agent, index: number): SourceInfo {
  return { ...agent.source, fieldPath: `frontmatter.skills[${index}]` };
}

async function hasDisableModelInvocation(skillPath: string): Promise<boolean> {
  try {
    const content = await fs.readFile(skillPath, "utf8");
    const parsed = parseFrontmatter(content);
    if (!parsed.ok) {
      return false;
    }
    return parsed.data["disable-model-invocation"] === true;
  } catch {
    return false;
  }
}

/**
 * Resolve skills listed in agent frontmatter for context preload (K1, K4, K5).
 * @see docs/SPEC.md §3.6
 */
export async function buildSkillPreloadCapabilities(
  agent: Agent,
  snapshot: ProjectSnapshot,
  context: ExecutionContext,
): Promise<ResolvedCapability[]> {
  if (context.isFork || agent.isPluginAgent) {
    return [];
  }

  const skillNames = agent.configuration.skills;
  if (!skillNames || skillNames.length === 0) {
    return [];
  }

  const discovered = snapshot.skills as DiscoveredSkill[];
  const capabilities: ResolvedCapability[] = [];

  for (const [index, skillName] of skillNames.entries()) {
    const skill = discovered.find((entry) => entry.name === skillName);
    const agentFieldSource = fieldSource(agent, index);

    if (!skill) {
      capabilities.push({
        capabilityId: `skill:${skillName}`,
        kind: "skill",
        status: "unknown",
        enforcement: "advisory",
        sources: [agentFieldSource],
        reasons: [
          makeReason(
            "unknown",
            `Skill "${skillName}" listed in frontmatter but not discovered (K5).`,
            agentFieldSource,
          ),
        ],
      });
      continue;
    }

    const skillSource: SourceInfo = {
      platform: "claude",
      scope: skill.source.scope,
      path: skill.path,
    };

    if (await hasDisableModelInvocation(skill.path)) {
      capabilities.push({
        capabilityId: `skill:${skillName}`,
        kind: "skill",
        status: "denied",
        enforcement: "enforced",
        sources: [agentFieldSource, skillSource],
        reasons: [
          makeReason(
            "denied",
            "Skill cannot be preloaded because disable-model-invocation is set (K4).",
            skillSource,
            "K4",
          ),
        ],
      });
      continue;
    }

    capabilities.push({
      capabilityId: `skill:${skillName}`,
      kind: "skill",
      status: "preloaded",
      enforcement: "enforced",
      sources: [agentFieldSource, skillSource],
      reasons: [
        makeReason(
          "declared",
          "Skill content preloaded into agent context from frontmatter skills list (K1).",
          agentFieldSource,
          "K1",
        ),
      ],
    });
  }

  return capabilities;
}
