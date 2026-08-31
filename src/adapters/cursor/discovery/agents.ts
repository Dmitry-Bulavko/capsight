import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import type { Scope, SourceInfo } from "../../../core/model/index.js";
import type { CursorAgent as Agent, CursorAgentConfiguration } from "../model/index.js";
import { CURSOR_PLATFORM } from "../model/index.js";
import {
  getStringField,
  parseFrontmatter,
} from "../parsing/frontmatter.js";
import { FACT } from "../version/facts.js";
import { gateCollision, gateDiscovery, MATRIX } from "../version/matrix.js";
import { redactUnknownFields } from "./redact.js";
import type { ProjectScopeLevel } from "./project-walk.js";
import type { AgentDiscoveryResult, RawAgentFile } from "./types.js";

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
  "model",
]);

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
  return { platform: CURSOR_PLATFORM, scope, path: filePath };
}

function buildConfiguration(data: Record<string, unknown>): CursorAgentConfiguration {
  const model = getStringField(data, "model");
  return {
    ...(Array.isArray(data.tools) ? { tools: data.tools.map(String) } : {}),
    ...(model !== undefined ? { model } : {}),
    unknownFields: redactUnknownFields(data, KNOWN_FRONTMATTER_KEYS),
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

  const data = parsed.data;
  const name = getStringField(data, "name");
  const description = getStringField(data, "description");

  if (!name) {
    return { kind: "invalid", file, invalidReason: "no-name" };
  }
  if (!description) {
    return { kind: "invalid", file, invalidReason: "no-description" };
  }

  const agent: Agent = {
    id: agentId(file.filePath),
    name,
    description,
    source: sourceInfo(file.scope, file.filePath),
    status: "active",
    configuration: buildConfiguration(data),
    isPluginAgent: false,
  };

  return { kind: "valid", file, agent };
}

function resolveCollisions(parsed: ParsedAgent[], version: string): Agent[] {
  const agents: Agent[] = [];
  const invalidAgents: Agent[] = [];

  const invalidGate = gateDiscovery(MATRIX["agent.invalid"], version);
  const collisionGate = gateCollision(MATRIX["collision.sameDir"], version);

  for (const item of parsed) {
    if (item.kind === "invalid") {
      if (invalidGate.unfounded) {
        continue;
      }
      invalidAgents.push({
        id: agentId(item.file.filePath),
        name: path.basename(item.file.filePath, ".md"),
        description: "",
        source: sourceInfo(item.file.scope, item.file.filePath),
        status: "invalid",
        invalidReason: item.invalidReason,
        configuration: { unknownFields: {} },
        isPluginAgent: false,
      });
    }
  }

  const valid = parsed.filter(
    (p): p is Extract<ParsedAgent, { kind: "valid" }> => p.kind === "valid",
  );

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
      if (group.length > 1 && !collisionGate.unfounded) {
        for (const item of group) {
          ambiguousIds.add(item.agent.id);
        }
      }
    }
  }

  for (const item of valid.filter((entry) => ambiguousIds.has(entry.agent.id))) {
    const group = byAgentsRoot.get(item.file.agentsRoot)!.get(item.agent.name)!;
    agents.push({
      ...item.agent,
      status: "ambiguous",
      collision: {
        candidates: group.map((g) => sourceInfo(g.file.scope, g.file.filePath)),
        rule: FACT.CA3,
        matrixRef: collisionGate.matrixRef,
        enforcement: collisionGate.enforcement,
      },
    });
  }

  const remaining = valid.filter((item) => !ambiguousIds.has(item.agent.id));
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
    const candidates = sorted.map((s) =>
      sourceInfo(s.file.scope, s.file.filePath),
    );

    agents.push({ ...winner.agent, status: "active" });

    for (const loser of sorted.slice(1)) {
      agents.push({
        ...loser.agent,
        status: "shadowed",
        collision: {
          candidates,
          effective: sourceInfo(winner.file.scope, winner.file.filePath),
          rule: FACT.CW4,
          matrixRef: MATRIX["collision.sameDir"],
          enforcement: collisionGate.enforcement,
        },
      });
    }
  }

  return [...agents, ...invalidAgents];
}

export async function discoverAgentSources(
  projectScopes: ProjectScopeLevel[],
  projectPath: string,
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

/** @see docs/CURSOR-FACTS.md CA1–CA3 */
export async function discoverAgents(
  projectScopes: ProjectScopeLevel[],
  projectPath: string,
  version: string,
): Promise<AgentDiscoveryResult> {
  const rawFiles = await discoverAgentSources(projectScopes, projectPath);
  const parsed = await Promise.all(rawFiles.map(parseAgentFile));
  const agents = resolveCollisions(parsed, version);
  const invalidCount = agents.filter((a) => a.status === "invalid").length;
  return { agents, invalidCount };
}
