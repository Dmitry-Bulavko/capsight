import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type {
  Scope,
  SourceInfo,
} from "../../../core/model/index.js";
import type {
  ClaudeAgent as Agent,
} from "../model/index.js";
import {
  getStringField,
  parseFrontmatter,
} from "../parsing/frontmatter.js";
import { buildAgentConfiguration } from "../parsing/agent-configuration.js";
import { collectMarkdownFiles } from "../io/collect-markdown.js";
import { isDirectory } from "../../shared/fs.js";
import type { ProjectScopeLevel } from "./project-walk.js";
import { pluginScopedId, resolvePluginInstallations } from "./plugins.js";
import type { RawAgentFile, AgentDiscoveryResult } from "./types.js";
import { FACT } from "../version/facts.js";
import { gateCollision, gateDiscovery, MATRIX } from "../version/matrix.js";
import { synthesizeBuiltinAgents } from "./builtins.js";
import { agentIdFromPath, SCOPE_PRIORITY } from "./ids.js";

function sourceInfo(
  scope: Scope,
  filePath: string,
  matrixRef?: string,
): SourceInfo {
  return matrixRef
    ? { platform: "claude", scope, path: filePath, matrixRef }
    : { platform: "claude", scope, path: filePath };
}

function fileSource(file: RawAgentFile): SourceInfo {
  return sourceInfo(file.scope, file.filePath, file.matrixRef);
}

type ParsedAgent =
  | { kind: "invalid"; file: RawAgentFile; invalidReason: Agent["invalidReason"] }
  | { kind: "valid"; file: RawAgentFile; agent: Agent };

async function parseAgentFile(file: RawAgentFile): Promise<ParsedAgent> {
  let content: string;
  try {
    content = await fs.readFile(file.filePath, "utf8");
  } catch {
    return { kind: "invalid", file, invalidReason: "bad-yaml" };
  }

  const parsed = parseFrontmatter(content);
  if (!parsed.ok && !file.isPluginAgent) {
    return { kind: "invalid", file, invalidReason: "bad-yaml" };
  }

  // A8 is the inverse of A7: frontmatter that does not parse skips a project
  // agent silently, but a plugin agent still loads — under its file name, with
  // no configuration to read.
  const data: Record<string, unknown> = parsed.ok ? parsed.data : {};

  const name = getStringField(data, "name");
  const description = getStringField(data, "description");

  if (!file.isPluginAgent) {
    if (!name) {
      return { kind: "invalid", file, invalidReason: "no-name" };
    }
    if (name.startsWith("-") || name.includes(":")) {
      return { kind: "invalid", file, invalidReason: "bad-name-chars" };
    }
    if (!description) {
      return { kind: "invalid", file, invalidReason: "no-description" };
    }
  } else {
    const pluginName = name ?? path.basename(file.filePath, ".md");
    if (!pluginName) {
      return { kind: "invalid", file, invalidReason: "no-name" };
    }
    data.name = pluginName;
  }

  const effectiveName = (getStringField(data, "name") ??
    path.basename(file.filePath, ".md"))!;
  const effectiveDescription =
    description ?? (file.isPluginAgent ? "" : undefined);

  if (!file.isPluginAgent && !effectiveDescription) {
    return { kind: "invalid", file, invalidReason: "no-description" };
  }

  const agent: Agent = {
    id: agentIdFromPath(file.filePath),
    name: effectiveName,
    description: effectiveDescription ?? "",
    source: fileSource(file),
    status: "active",
    configuration: buildAgentConfiguration(data),
    isPluginAgent: file.isPluginAgent,
    ...(file.isPluginAgent && file.pluginName !== undefined
      ? {
          pluginScopedId: pluginScopedId(
            file.pluginName,
            file.agentsRoot,
            file.filePath,
            effectiveName,
          ),
        }
      : {}),
  };

  return { kind: "valid", file, agent };
}

function resolveCollisions(parsed: ParsedAgent[], version: string): Agent[] {
  const agents: Agent[] = [];
  const invalidAgents: Agent[] = [];

  for (const item of parsed) {
    if (item.kind === "invalid") {
      invalidAgents.push({
        id: agentIdFromPath(item.file.filePath),
        name: path.basename(item.file.filePath, ".md"),
        description: "",
        source: fileSource(item.file),
        status: "invalid",
        invalidReason: item.invalidReason,
        configuration: { unknownFields: {} },
        isPluginAgent: item.file.isPluginAgent,
      });
    }
  }

  const valid = parsed.filter((p): p is Extract<ParsedAgent, { kind: "valid" }> => p.kind === "valid");

  const byAgentsRoot = new Map<string, Map<string, Extract<ParsedAgent, { kind: "valid" }>[]>>();
  for (const item of valid) {
    const root = item.file.agentsRoot;
    if (!byAgentsRoot.has(root)) {
      byAgentsRoot.set(root, new Map());
    }
    const byName = byAgentsRoot.get(root)!;
    if (!byName.has(item.agent.name)) {
      byName.set(item.agent.name, []);
    }
    byName.get(item.agent.name)!.push(item);
  }

  const ambiguousIds = new Set<string>();
  for (const byName of byAgentsRoot.values()) {
    for (const [, group] of byName) {
      if (group.length > 1) {
        for (const item of group) {
          ambiguousIds.add(item.agent.id);
        }
      }
    }
  }

  const remaining = valid.filter((item) => !ambiguousIds.has(item.agent.id));
  // A4 documents that one file loads but not which, so its entry is `unknown`
  // by construction and the gate keeps this record winner-free.
  const sameDirGate = gateCollision(FACT.A4, version);
  for (const item of valid.filter((item) => ambiguousIds.has(item.agent.id))) {
    const group = byAgentsRoot.get(item.file.agentsRoot)!.get(item.agent.name)!;
    agents.push({
      ...item.agent,
      status: "ambiguous",
      collision: {
        candidates: group.map((g) => fileSource(g.file)),
        rule: FACT.A4,
        matrixRef: sameDirGate.matrixRef,
        enforcement: sameDirGate.enforcement,
      },
    });
  }

  const byName = new Map<string, Extract<ParsedAgent, { kind: "valid" }>[]>();
  for (const item of remaining) {
    if (!byName.has(item.agent.name)) {
      byName.set(item.agent.name, []);
    }
    byName.get(item.agent.name)!.push(item);
  }

  for (const [, group] of byName) {
    const sorted = [...group].sort((a, b) => {
      const priorityDiff = b.file.scopePriority - a.file.scopePriority;
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      return a.file.scopeDistance - b.file.scopeDistance;
    });

    const winner = sorted[0]!;
    const runnerUp = sorted[1];
    const candidates = sorted.map((s) => fileSource(s.file));

    // The rule that decides the winner is the one separating the top two
    // candidates: A3 when they tie on scope priority, A1 otherwise.
    const decidingRule =
      runnerUp && runnerUp.file.scopePriority === winner.file.scopePriority
        ? FACT.A3
        : FACT.A1;
    const decidingGate = gateCollision(decidingRule, version);

    if (runnerUp && decidingGate.winnerUnfounded) {
      // The matrix does not found the winner rule on this version, so no file
      // is named effective — the whole group stays ambiguous (§8.2, §8.4).
      for (const item of sorted) {
        agents.push({
          ...item.agent,
          status: "ambiguous",
          collision: {
            candidates,
            rule: decidingRule,
            matrixRef: decidingGate.matrixRef,
            enforcement: decidingGate.enforcement,
          },
        });
      }
      continue;
    }

    agents.push({ ...winner.agent, status: "active" });

    for (const loser of sorted.slice(1)) {
      const rule =
        loser.file.scopePriority === winner.file.scopePriority ? FACT.A3 : FACT.A1;
      const gate = gateCollision(rule, version);
      agents.push({
        ...loser.agent,
        status: "shadowed",
        collision: {
          candidates,
          effective: fileSource(winner.file),
          rule,
          matrixRef: gate.matrixRef,
          enforcement: gate.enforcement,
        },
      });
    }
  }

  return [...agents, ...invalidAgents];
}

/**
 * Attach synthetic B1 builtins and shadow any whose name an active file-backed
 * agent reuses (B4). Builtins rank below every configured agents directory.
 */
function mergeBuiltinAgents(
  fileAgents: Agent[],
  version: string,
): Agent[] {
  const inventoryGate = gateDiscovery(MATRIX["discovery.builtinInventory"], version);
  const builtins = synthesizeBuiltinAgents().map((builtin) =>
    inventoryGate.unfounded ? { ...builtin, status: "unknown" as const } : builtin,
  );
  const activeByName = new Map<string, Agent>();
  for (const agent of fileAgents) {
    if (agent.status === "active") {
      activeByName.set(agent.name, agent);
    }
  }

  const overrideGate = gateCollision(FACT.B4, version);
  const merged: Agent[] = [...fileAgents];

  for (const builtin of builtins) {
    const override = activeByName.get(builtin.name);
    if (override) {
      if (overrideGate.winnerUnfounded) {
        // The matrix does not found B4 on this version, so no candidate is named
        // effective — the builtin stays winner-free (§8.2, §8.4).
        merged.push({
          ...builtin,
          status: "ambiguous",
          collision: {
            candidates: [builtin.source, override.source],
            rule: FACT.B4,
            matrixRef: overrideGate.matrixRef,
            enforcement: overrideGate.enforcement,
          },
        });
      } else {
        merged.push({
          ...builtin,
          status: "shadowed",
          collision: {
            candidates: [builtin.source, override.source],
            effective: override.source,
            rule: FACT.B4,
            matrixRef: overrideGate.matrixRef,
            enforcement: overrideGate.enforcement,
          },
        });
      }
    } else {
      merged.push(builtin);
    }
  }

  return merged;
}

export async function discoverAgentSources(
  projectScopes: ProjectScopeLevel[],
  projectPath: string,
  addDirs: string[] = [],
  /** Configured plugin roots (§3 establishes no install location — see plugins.ts). */
  pluginRoots: string[] = [],
): Promise<RawAgentFile[]> {
  const sources: Omit<RawAgentFile, "filePath">[] = [];
  const resolvedProject = path.resolve(projectPath);

  projectScopes.forEach((scope, index) => {
    if (!scope.agentsPath) {
      return;
    }
    const scopeType: Scope =
      path.resolve(scope.path) === resolvedProject ? "project" : "nested-project";
    sources.push({
      scope: scopeType,
      agentsRoot: scope.agentsPath,
      scopeDistance: index,
      scopePriority: SCOPE_PRIORITY[scopeType],
      isPluginAgent: false,
    });
  });

  const userAgents = path.join(os.homedir(), ".claude", "agents");
  if (await isDirectory(userAgents)) {
    sources.push({
      scope: "user",
      agentsRoot: userAgents,
      scopeDistance: 0,
      scopePriority: SCOPE_PRIORITY.user,
      isPluginAgent: false,
    });
  }

  for (const addDir of addDirs) {
    const agentsPath = path.join(path.resolve(addDir), ".claude", "agents");
    if (await isDirectory(agentsPath)) {
      sources.push({
        scope: "unknown",
        agentsRoot: agentsPath,
        scopeDistance: 0,
        scopePriority: SCOPE_PRIORITY.unknown,
        isPluginAgent: false,
        matrixRef: MATRIX["discovery.addDirAgents"],
      });
    }
  }

  // Plugin `agents/` directories come last and rank lowest: A1 puts them below
  // `~/.claude/agents/`, so a plugin never shadows an agent the user wrote.
  const installations = await resolvePluginInstallations(pluginRoots);
  installations.forEach((installation, index) => {
    if (!installation.agentsPath) {
      return;
    }
    sources.push({
      scope: "plugin",
      agentsRoot: installation.agentsPath,
      scopeDistance: index,
      scopePriority: SCOPE_PRIORITY.plugin,
      isPluginAgent: true,
      pluginName: installation.name,
    });
  });

  const rawFiles: RawAgentFile[] = [];
  for (const source of sources) {
    const markdownFiles = await collectMarkdownFiles(source.agentsRoot);
    for (const filePath of markdownFiles) {
      rawFiles.push({ ...source, filePath });
    }
  }

  return rawFiles;
}

/**
 * Downgrade an agent whose discovery rule the matrix does not found on this
 * version: the file was read, but that the platform loads it is a claim with
 * no basis, so the agent is reported as `unknown` rather than `active`
 * (§8.2, §8.3). Agents the ordinary scope walk found carry no `matrixRef` and
 * are untouched, which keeps the gate mechanical rather than a curated list.
 */
function gateDiscoveredAgents(agents: Agent[], version: string): Agent[] {
  return agents.map((agent) => {
    const matrixRef = agent.source.matrixRef;
    if (!matrixRef || agent.status === "invalid") {
      return agent;
    }
    return gateDiscovery(matrixRef, version).unfounded
      ? { ...agent, status: "unknown" }
      : agent;
  });
}

export async function discoverAgents(
  projectScopes: ProjectScopeLevel[],
  projectPath: string,
  addDirs: string[] = [],
  /** Detected CLI version, `"unknown"` in degraded mode (§8.3). */
  version = "unknown",
  /** Configured plugin roots (§3 establishes no install location — see plugins.ts). */
  pluginRoots: string[] = [],
): Promise<AgentDiscoveryResult> {
  const rawFiles = await discoverAgentSources(
    projectScopes,
    projectPath,
    addDirs,
    pluginRoots,
  );
  const parsed = await Promise.all(rawFiles.map(parseAgentFile));
  const fileAgents = gateDiscoveredAgents(resolveCollisions(parsed, version), version);
  const agents = mergeBuiltinAgents(fileAgents, version);
  const invalidCount = agents.filter((a) => a.status === "invalid").length;
  return { agents, invalidCount };
}
