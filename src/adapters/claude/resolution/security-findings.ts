import fs from "node:fs/promises";
import type {
  ResolvedCapability,
  SourceInfo,
  Warning,
} from "../../../core/model/index.js";
import type {
  ClaudeAgent as Agent,
  ClaudeProjectSnapshot as ProjectSnapshot,
  RedactedMcpServer,
} from "../model/index.js";
import { FACT, type FactId } from "../version/facts.js";
import type { DiscoveredSkill, SettingsLayer } from "../discovery/types.js";
import { parseFrontmatter } from "../parsing/frontmatter.js";
import { isInlineMcpServerEntry } from "./trust.js";

const SENSITIVE_ALLOWED_TOOL_BASES = new Set(["Bash", "Write", "Edit", "Agent"]);
const INEFFECTIVE_ALLOW_GLOBS = new Set(["*", "mcp__*"]);

export interface ResolveSecurityFindingsInput {
  agent: Agent;
  snapshot: ProjectSnapshot;
  toolCapabilities: ResolvedCapability[];
}

function securityWarning(
  message: string,
  evidence: SourceInfo[],
  matrixRef?: FactId,
): Warning {
  return {
    category: "security-finding",
    severity: "warning",
    message,
    evidence,
    matrixRef,
  };
}

function allowedToolBase(pattern: string): string {
  const parenIndex = pattern.indexOf("(");
  return (parenIndex === -1 ? pattern : pattern.slice(0, parenIndex)).trim();
}

export function isSensitiveAllowedToolPattern(pattern: string): boolean {
  return SENSITIVE_ALLOWED_TOOL_BASES.has(allowedToolBase(pattern));
}

export function isIneffectiveAllowGlob(pattern: string): boolean {
  return INEFFECTIVE_ALLOW_GLOBS.has(pattern);
}

function findBashGuardrailWarning(
  agent: Agent,
  toolCapabilities: ResolvedCapability[],
): Warning | undefined {
  const hasBash = toolCapabilities.some(
    (capability) => capability.capabilityId === "Bash" && capability.status === "available",
  );
  const hasRestrictions =
    agent.configuration.tools !== undefined ||
    agent.configuration.disallowedTools !== undefined;

  if (!hasBash || !hasRestrictions) {
    return undefined;
  }

  return securityWarning(
    "Agent has Bash access. Tool-level restrictions are a guardrail, not a complete security boundary.",
    [agent.source],
  );
}

function findBypassPermissionsWarning(agent: Agent): Warning | undefined {
  if (agent.configuration.permissionMode !== "bypassPermissions") {
    return undefined;
  }

  return securityWarning(
    "Agent declares permissionMode bypassPermissions, which skips permission prompts.",
    [{ ...agent.source, fieldPath: "frontmatter.permissionMode" }],
    FACT.P5,
  );
}

function findInlineMcpCommandWarnings(agent: Agent): Warning[] {
  const warnings: Warning[] = [];

  for (const [index, entry] of (agent.configuration.mcpServers ?? []).entries()) {
    if (!isInlineMcpServerEntry(entry)) {
      continue;
    }

    const record = entry as RedactedMcpServer;
    if (typeof record.commandName !== "string" || record.commandName.length === 0) {
      continue;
    }

    warnings.push(
      securityWarning(
        `Inline MCP server runs arbitrary command "${record.commandName}" from agent frontmatter.`,
        [{ ...agent.source, fieldPath: `frontmatter.mcpServers[${index}]` }],
        FACT.R1,
      ),
    );
  }

  return warnings;
}

async function readAllowedToolsFromSkill(skillPath: string): Promise<string[]> {
  try {
    const content = await fs.readFile(skillPath, "utf8");
    const parsed = parseFrontmatter(content);
    if (!parsed.ok) {
      return [];
    }

    const raw =
      parsed.data["allowed-tools"] ?? parsed.data.allowedTools ?? parsed.data["allowed_tools"];
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw.map(String);
  } catch {
    return [];
  }
}

async function findSkillAllowedToolsWarnings(
  snapshot: ProjectSnapshot,
): Promise<Warning[]> {
  const skills = snapshot.skills as DiscoveredSkill[];
  const warnings: Warning[] = [];

  for (const skill of skills) {
    const allowedTools = await readAllowedToolsFromSkill(skill.path);
    for (const [index, pattern] of allowedTools.entries()) {
      if (!isSensitiveAllowedToolPattern(pattern)) {
        continue;
      }

      warnings.push(
        securityWarning(
          `Skill pre-approves sensitive tool "${pattern}" via allowed-tools (K6, K7).`,
          [
            {
              platform: "claude",
              scope: skill.source.scope,
              path: skill.path,
              fieldPath: `frontmatter.allowed-tools[${index}]`,
            },
          ],
          FACT.K6,
        ),
      );
    }
  }

  return warnings;
}

async function readFalseAllowGlobWarnings(
  settingsLayers: unknown[],
): Promise<Warning[]> {
  const layers = settingsLayers as SettingsLayer[];
  const warnings: Warning[] = [];

  for (const layer of layers) {
    try {
      const raw = await fs.readFile(layer.path, "utf8");
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null) {
        continue;
      }

      const permissions = (parsed as { permissions?: { allow?: unknown } }).permissions;
      if (!permissions || !Array.isArray(permissions.allow)) {
        continue;
      }

      for (const [index, entry] of permissions.allow.entries()) {
        const pattern = String(entry);
        if (!isIneffectiveAllowGlob(pattern)) {
          continue;
        }

        warnings.push(
          securityWarning(
            `permissions.allow entry "${pattern}" is an unanchored glob and does not grant access (S4).`,
            [
              {
                platform: "claude",
                scope: layer.scope,
                path: layer.path,
                fieldPath: `permissions.allow[${index}]`,
              },
            ],
            FACT.S4,
          ),
        );
      }
    } catch {
      continue;
    }
  }

  return warnings;
}

/**
 * Emit non-blocking security findings for an agent resolution.
 * @see docs/SPEC.md §7.6, K6, K7, S4
 */
export async function resolveSecurityFindings(
  input: ResolveSecurityFindingsInput,
): Promise<Warning[]> {
  const { agent, snapshot, toolCapabilities } = input;
  const warnings: Warning[] = [];

  const bashGuardrail = findBashGuardrailWarning(agent, toolCapabilities);
  if (bashGuardrail) {
    warnings.push(bashGuardrail);
  }

  const bypassWarning = findBypassPermissionsWarning(agent);
  if (bypassWarning) {
    warnings.push(bypassWarning);
  }

  warnings.push(...findInlineMcpCommandWarnings(agent));
  warnings.push(...await findSkillAllowedToolsWarnings(snapshot));
  warnings.push(...await readFalseAllowGlobWarnings(snapshot.settings));

  return warnings;
}
