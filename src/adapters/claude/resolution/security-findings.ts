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
import { MATRIX, gateWarning } from "../version/matrix.js";
import type { DiscoveredSkill, SettingsLayer } from "../discovery/types.js";
import { parseFrontmatter } from "../parsing/frontmatter.js";
import { isInlineMcpServerEntry } from "./trust.js";
import { findBareToolDenial } from "./settings-permissions.js";
import { isPluginIneffectiveField } from "./plugin.js";

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
  severity: Warning["severity"] = "warning",
  relatedCapabilityIds?: string[],
): Warning {
  return {
    category: "security-finding",
    severity,
    message,
    evidence,
    matrixRef,
    ...(relatedCapabilityIds && relatedCapabilityIds.length > 0
      ? { relatedCapabilityIds }
      : {}),
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
    undefined,
    "warning",
    ["Bash"],
  );
}

/**
 * A finding about a frontmatter field the platform ignores for plugin agents
 * (F9) would contradict the `ignored-field` warning the same resolution emits.
 * The warning still reports that the field was written; only the claim about
 * its effect is dropped (§2.4). Findings not premised on an F9 field — a skill
 * pre-approving sensitive tools, an unanchored `allow` glob — are unaffected.
 */
function isNullifiedByPluginLimits(agent: Agent, field: string): boolean {
  return agent.isPluginAgent && isPluginIneffectiveField(field);
}

function findBypassPermissionsWarning(agent: Agent): Warning | undefined {
  if (isNullifiedByPluginLimits(agent, "permissionMode")) {
    return undefined;
  }

  if (agent.configuration.permissionMode !== "bypassPermissions") {
    return undefined;
  }

  return securityWarning(
    "Agent declares permissionMode bypassPermissions, which skips permission prompts.",
    [{ ...agent.source, fieldPath: "frontmatter.permissionMode" }],
    FACT.P5,
    "warning",
    ["permission:bypassPermissions"],
  );
}

function findInlineMcpCommandWarnings(agent: Agent): Warning[] {
  if (isNullifiedByPluginLimits(agent, "mcpServers")) {
    return [];
  }

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
        "warning",
        [`inline-mcp:${index}`],
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

/**
 * K6/K7 findings, and the one case where the finding would be wrong.
 *
 * A skill's `allowed-tools` entry pre-approves a tool rather than restricting
 * the agent (K6), and it applies to any invocation of the skill (K7) — which
 * is why a pre-approval of a sensitive tool is a finding. But a settings layer
 * that denies the bare tool name has removed that tool from the session (S5),
 * a deny is not overridden at any level (S2) and K8 states the same for
 * `allowed-tools` in particular, so there is nothing left for the entry to
 * pre-approve. The finding is not dropped: reporting the pre-approval as a risk
 * would be a confident wrong claim (§11.3), and reporting nothing would hide a
 * line the skill file really contains, so the finding states what the entry is
 * and why it has no effect, at `info`.
 *
 * Only a *bare* deny is acted on. Whether a deny of the form `Bash(rm:*)`
 * covers a pre-approval of `Bash(git push:*)` is a question about which
 * invocations a rule matches, and this product does not evaluate rule arguments
 * (§2.3): such a pair keeps the ordinary K6/K7 finding, since S2 says the deny
 * is not overridden but not what it leaves of the pre-approval.
 */
async function findSkillAllowedToolsWarnings(
  snapshot: ProjectSnapshot,
): Promise<Warning[]> {
  const skills = snapshot.skills as DiscoveredSkill[];
  const layers = snapshot.settings as SettingsLayer[];
  const version = snapshot.version.version;
  const warnings: Warning[] = [];

  for (const skill of skills) {
    const allowedTools = await readAllowedToolsFromSkill(skill.path);
    for (const [index, pattern] of allowedTools.entries()) {
      if (!isSensitiveAllowedToolPattern(pattern)) {
        continue;
      }

      const evidence: SourceInfo = {
        platform: "claude",
        scope: skill.source.scope,
        path: skill.path,
        fieldPath: `frontmatter.allowed-tools[${index}]`,
      };
      const denial = findBareToolDenial(layers, allowedToolBase(pattern));

      const toolId = allowedToolBase(pattern);

      warnings.push(
        denial
          ? gateWarning(
              securityWarning(
                `Skill pre-approves "${pattern}" via allowed-tools, but a settings layer ` +
                  `denies "${denial.rule.raw}", which removes the tool from the session (S5). ` +
                  "A deny rule is not overridden at any level (S2) and does not yield to " +
                  "allowed-tools (K8), so the pre-approval has nothing to approve.",
                [evidence, denial.source],
                FACT.K8,
                "info",
                [toolId],
              ),
              MATRIX["skills.denyBeatsAllowedTools"],
              version,
            )
          : securityWarning(
              `Skill pre-approves sensitive tool "${pattern}" via allowed-tools (K6, K7).`,
              [evidence],
              FACT.K6,
              "warning",
              [toolId],
            ),
      );
    }
  }

  return warnings;
}

/**
 * S4 findings, read from the permission rules discovery already parsed. The
 * claim is about platform behaviour — the glob grants nothing — so it goes
 * through the matrix gate like any other §6 claim.
 */
function findFalseAllowGlobWarnings(
  settingsLayers: unknown[],
  version: string,
): Warning[] {
  const layers = settingsLayers as SettingsLayer[];
  const warnings: Warning[] = [];

  for (const layer of layers) {
    for (const rule of layer.permissions?.rules ?? []) {
      if (rule.action !== "allow" || !isIneffectiveAllowGlob(rule.raw)) {
        continue;
      }

      warnings.push(
        gateWarning(
          securityWarning(
            `permissions.allow entry "${rule.raw}" is an unanchored glob and does not grant access (S4).`,
            [
              {
                platform: "claude",
                scope: layer.scope,
                path: layer.path,
                fieldPath: `permissions.allow[${rule.index}]`,
              },
            ],
            FACT.S4,
            "warning",
            [`settings-permission:${layer.scope}:allow:${rule.raw}`],
          ),
          MATRIX["settings.allowGlobIneffective"],
          version,
        ),
      );
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
  warnings.push(
    ...findFalseAllowGlobWarnings(snapshot.settings, snapshot.version.version),
  );

  return warnings;
}
