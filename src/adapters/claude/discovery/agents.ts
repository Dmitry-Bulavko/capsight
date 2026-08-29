import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import os from "node:os";
import type {
  Scope,
  SourceInfo,
} from "../../../core/model/index.js";
import type {
  ClaudeAgent as Agent,
  ClaudeAgentConfiguration as AgentConfiguration,
} from "../model/index.js";
import {
  getStringField,
  parseFrontmatter,
} from "../parsing/frontmatter.js";
import type { ProjectScopeLevel } from "./project-walk.js";
import { pluginScopedId, resolvePluginInstallations } from "./plugins.js";
import type { RawAgentFile, AgentDiscoveryResult } from "./types.js";
import { FACT } from "../version/facts.js";
import { gateCollision, gateDiscovery, MATRIX } from "../version/matrix.js";
import {
  redactMcpServers,
  redactUnknownFields,
  summarizeHooks,
} from "./redact.js";

const SCOPE_PRIORITY: Record<Scope, number> = {
  managed: 50,
  cli: 40,
  project: 30,
  "nested-project": 30,
  local: 25,
  user: 20,
  plugin: 10,
  unknown: 0,
};

const KNOWN_FRONTMATTER_KEYS = new Set([
  "name",
  "description",
  "tools",
  "disallowedTools",
  "model",
  "permissionMode",
  "maxTurns",
  "skills",
  "hooks",
  "mcpServers",
  "memory",
  "background",
  "effort",
  "isolation",
  "color",
  "initialPrompt",
]);

async function isDirectory(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function collectMarkdownFiles(rootDir: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        results.push(fullPath);
      }
    }
  }

  await walk(rootDir);
  return results.sort();
}

function agentId(filePath: string): string {
  return createHash("sha256").update(filePath).digest("hex").slice(0, 16);
}

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

function buildConfiguration(data: Record<string, unknown>): AgentConfiguration {
  const unknownFields = redactUnknownFields(data, KNOWN_FRONTMATTER_KEYS);

  return {
    tools: Array.isArray(data.tools) ? data.tools.map(String) : undefined,
    disallowedTools: Array.isArray(data.disallowedTools)
      ? data.disallowedTools.map(String)
      : undefined,
    mcpServers: redactMcpServers(data.mcpServers),
    model: getStringField(data, "model"),
    permissionMode: getStringField(data, "permissionMode") as AgentConfiguration["permissionMode"],
    maxTurns: typeof data.maxTurns === "number" ? data.maxTurns : undefined,
    skills: Array.isArray(data.skills) ? data.skills.map(String) : undefined,
    hooks: summarizeHooks(data.hooks),
    memory: getStringField(data, "memory") as AgentConfiguration["memory"],
    background: typeof data.background === "boolean" ? data.background : undefined,
    effort: getStringField(data, "effort"),
    isolation: getStringField(data, "isolation") as AgentConfiguration["isolation"],
    initialPrompt: getStringField(data, "initialPrompt"),
    color: getStringField(data, "color"),
    unknownFields,
  };
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
    id: agentId(file.filePath),
    name: effectiveName,
    description: effectiveDescription ?? "",
    source: fileSource(file),
    status: "active",
    configuration: buildConfiguration(data),
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
        id: agentId(item.file.filePath),
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
  const agents = gateDiscoveredAgents(resolveCollisions(parsed, version), version);
  const invalidCount = agents.filter((a) => a.status === "invalid").length;
  return { agents, invalidCount };
}
