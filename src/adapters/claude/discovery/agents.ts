import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import os from "node:os";
import type { Agent, AgentConfiguration, Scope, SourceInfo } from "../../../core/model/index.js";
import {
  getStringField,
  parseFrontmatter,
} from "../parsing/frontmatter.js";
import type { ProjectScopeLevel } from "./project-walk.js";
import type { RawAgentFile, AgentDiscoveryResult } from "./types.js";
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

function sourceInfo(scope: Scope, filePath: string): SourceInfo {
  return { platform: "claude", scope, path: filePath };
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
  if (!parsed.ok) {
    return { kind: "invalid", file, invalidReason: "bad-yaml" };
  }

  const name = getStringField(parsed.data, "name");
  const description = getStringField(parsed.data, "description");

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
    const effectiveName = name ?? path.basename(file.filePath, ".md");
    if (!effectiveName) {
      return { kind: "invalid", file, invalidReason: "no-name" };
    }
    parsed.data.name = effectiveName;
  }

  const effectiveName = (getStringField(parsed.data, "name") ??
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
    source: sourceInfo(file.scope, file.filePath),
    status: "active",
    configuration: buildConfiguration(parsed.data),
    isPluginAgent: file.isPluginAgent,
  };

  return { kind: "valid", file, agent };
}

function resolveCollisions(parsed: ParsedAgent[]): Agent[] {
  const agents: Agent[] = [];
  const invalidAgents: Agent[] = [];

  for (const item of parsed) {
    if (item.kind === "invalid") {
      invalidAgents.push({
        id: agentId(item.file.filePath),
        name: path.basename(item.file.filePath, ".md"),
        description: "",
        source: sourceInfo(item.file.scope, item.file.filePath),
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
  for (const item of valid.filter((item) => ambiguousIds.has(item.agent.id))) {
    const group = byAgentsRoot.get(item.file.agentsRoot)!.get(item.agent.name)!;
    agents.push({
      ...item.agent,
      status: "ambiguous",
      collision: {
        candidates: group.map((g) => sourceInfo(g.file.scope, g.file.filePath)),
        rule: "A4",
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
    agents.push({ ...winner.agent, status: "active" });

    for (const loser of sorted.slice(1)) {
      agents.push({
        ...loser.agent,
        status: "shadowed",
        collision: {
          candidates: sorted.map((s) => sourceInfo(s.file.scope, s.file.filePath)),
          effective: sourceInfo(winner.file.scope, winner.file.filePath),
          rule: loser.file.scopePriority === winner.file.scopePriority ? "A3" : "A1",
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
      });
    }
  }

  const rawFiles: RawAgentFile[] = [];
  for (const source of sources) {
    const markdownFiles = await collectMarkdownFiles(source.agentsRoot);
    for (const filePath of markdownFiles) {
      rawFiles.push({ ...source, filePath });
    }
  }

  return rawFiles;
}

export async function discoverAgents(
  projectScopes: ProjectScopeLevel[],
  projectPath: string,
  addDirs: string[] = [],
): Promise<AgentDiscoveryResult> {
  const rawFiles = await discoverAgentSources(projectScopes, projectPath, addDirs);
  const parsed = await Promise.all(rawFiles.map(parseAgentFile));
  const agents = resolveCollisions(parsed);
  const invalidCount = agents.filter((a) => a.status === "invalid").length;
  return { agents, invalidCount };
}
