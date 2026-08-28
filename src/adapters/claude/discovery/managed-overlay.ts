import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import type {
  Scope,
  SourceInfo,
} from "../../../core/model/index.js";
import type {
  ClaudeAgent as Agent,
  ClaudeAgentConfiguration as AgentConfiguration,
  ClaudeProjectSnapshot as ProjectSnapshot,
} from "../model/index.js";
import {
  getStringField,
  parseFrontmatter,
} from "../parsing/frontmatter.js";
import type { SettingsLayer } from "./types.js";
import { FACT } from "../version/facts.js";
import { gateCollision } from "../version/matrix.js";
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

export class ManagedBundleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManagedBundleError";
  }
}

export interface ManagedBundle {
  bundlePath: string;
  settingsLayer?: SettingsLayer;
  availableModels?: string[];
  agents: Agent[];
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

async function parseManagedAgentFile(filePath: string): Promise<Agent | null> {
  let content: string;
  try {
    content = await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }

  const parsed = parseFrontmatter(content);
  if (!parsed.ok) {
    return {
      id: agentId(filePath),
      name: path.basename(filePath, ".md"),
      description: "",
      source: sourceInfo("managed", filePath),
      status: "invalid",
      invalidReason: "bad-yaml",
      configuration: { unknownFields: {} },
      isPluginAgent: false,
    };
  }

  const name = getStringField(parsed.data, "name");
  const description = getStringField(parsed.data, "description");

  if (!name) {
    return {
      id: agentId(filePath),
      name: path.basename(filePath, ".md"),
      description: "",
      source: sourceInfo("managed", filePath),
      status: "invalid",
      invalidReason: "no-name",
      configuration: { unknownFields: {} },
      isPluginAgent: false,
    };
  }

  if (name.startsWith("-") || name.includes(":")) {
    return {
      id: agentId(filePath),
      name,
      description: description ?? "",
      source: sourceInfo("managed", filePath),
      status: "invalid",
      invalidReason: "bad-name-chars",
      configuration: { unknownFields: {} },
      isPluginAgent: false,
    };
  }

  if (!description) {
    return {
      id: agentId(filePath),
      name,
      description: "",
      source: sourceInfo("managed", filePath),
      status: "invalid",
      invalidReason: "no-description",
      configuration: { unknownFields: {} },
      isPluginAgent: false,
    };
  }

  return {
    id: agentId(filePath),
    name,
    description,
    source: sourceInfo("managed", filePath),
    status: "active",
    configuration: buildConfiguration(parsed.data),
    isPluginAgent: false,
  };
}

function agentsRootFor(filePath: string): string {
  return path.dirname(filePath);
}

function reconcileAgentCollisions(agents: Agent[], version: string): Agent[] {
  const invalidAgents = agents.filter((agent) => agent.status === "invalid");
  const validAgents = agents.filter((agent) => agent.status !== "invalid");

  const byRoot = new Map<string, Map<string, Agent[]>>();
  for (const agent of validAgents) {
    const root = agentsRootFor(agent.source.path ?? agent.name);
    if (!byRoot.has(root)) {
      byRoot.set(root, new Map());
    }
    const byName = byRoot.get(root)!;
    if (!byName.has(agent.name)) {
      byName.set(agent.name, []);
    }
    byName.get(agent.name)!.push(agent);
  }

  const ambiguousIds = new Set<string>();
  for (const byName of byRoot.values()) {
    for (const group of byName.values()) {
      if (group.length > 1) {
        for (const agent of group) {
          ambiguousIds.add(agent.id);
        }
      }
    }
  }

  // A4's entry is `unknown` by construction: one file loads, but which is not
  // documented, so the record stays winner-free whatever the version.
  const sameDirGate = gateCollision(FACT.A4, version);

  const resolved: Agent[] = [];
  for (const agent of validAgents) {
    if (ambiguousIds.has(agent.id)) {
      const group = byRoot.get(agentsRootFor(agent.source.path ?? agent.name))!.get(agent.name)!;
      resolved.push({
        ...agent,
        status: "ambiguous",
        collision: {
          candidates: group.map((entry) => entry.source),
          rule: FACT.A4,
          ...(sameDirGate.matrixRef ? { matrixRef: sameDirGate.matrixRef } : {}),
          ...(sameDirGate.enforcement
            ? { enforcement: sameDirGate.enforcement }
            : {}),
        },
      });
    }
  }

  const remaining = validAgents.filter((agent) => !ambiguousIds.has(agent.id));
  const byName = new Map<string, Agent[]>();
  for (const agent of remaining) {
    if (!byName.has(agent.name)) {
      byName.set(agent.name, []);
    }
    byName.get(agent.name)!.push(agent);
  }

  for (const group of byName.values()) {
    const sorted = [...group].sort((left, right) => {
      const priorityDiff =
        SCOPE_PRIORITY[right.source.scope] - SCOPE_PRIORITY[left.source.scope];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      return (left.source.path ?? "").localeCompare(right.source.path ?? "");
    });

    const winner = sorted[0]!;
    const runnerUp = sorted[1];
    const candidates = sorted.map((entry) => entry.source);

    // The winner is decided by the rule separating the top two candidates.
    const decidingRule =
      runnerUp &&
      SCOPE_PRIORITY[runnerUp.source.scope] === SCOPE_PRIORITY[winner.source.scope]
        ? FACT.A3
        : FACT.A1;
    const decidingGate = gateCollision(decidingRule, version);

    if (runnerUp && decidingGate.winnerUnfounded) {
      for (const agent of sorted) {
        resolved.push({
          ...agent,
          status: "ambiguous",
          collision: {
            candidates,
            rule: decidingRule,
            ...(decidingGate.matrixRef ? { matrixRef: decidingGate.matrixRef } : {}),
            ...(decidingGate.enforcement
              ? { enforcement: decidingGate.enforcement }
              : {}),
          },
        });
      }
      continue;
    }

    resolved.push({ ...winner, status: "active", collision: undefined });

    for (const loser of sorted.slice(1)) {
      const rule =
        SCOPE_PRIORITY[loser.source.scope] === SCOPE_PRIORITY[winner.source.scope]
          ? FACT.A3
          : FACT.A1;
      const gate = gateCollision(rule, version);
      resolved.push({
        ...loser,
        status: "shadowed",
        collision: {
          candidates,
          effective: winner.source,
          rule,
          ...(gate.matrixRef ? { matrixRef: gate.matrixRef } : {}),
          ...(gate.enforcement ? { enforcement: gate.enforcement } : {}),
        },
      });
    }
  }

  return [...resolved, ...invalidAgents].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

async function discoverManagedAgents(bundlePath: string): Promise<Agent[]> {
  const agentsDir = path.join(bundlePath, "agents");
  if (!(await isDirectory(agentsDir))) {
    return [];
  }

  const markdownFiles = await collectMarkdownFiles(agentsDir);
  const parsed = await Promise.all(
    markdownFiles.map((filePath) => parseManagedAgentFile(filePath)),
  );

  return parsed.filter((agent): agent is Agent => agent !== null);
}

async function readManagedSettings(bundlePath: string): Promise<{
  settingsLayer?: SettingsLayer;
  availableModels?: string[];
}> {
  const settingsPath = path.join(bundlePath, "settings.json");
  try {
    const raw = await fs.readFile(settingsPath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      throw new ManagedBundleError(`Invalid managed settings.json at ${settingsPath}`);
    }

    const record = parsed as Record<string, unknown>;
    const availableModels = Array.isArray(record.availableModels)
      ? record.availableModels.map(String)
      : undefined;

    return {
      settingsLayer: {
        scope: "managed",
        path: settingsPath,
        priority: 60,
      },
      availableModels,
    };
  } catch (error) {
    if (error instanceof ManagedBundleError) {
      throw error;
    }
    return {};
  }
}

/**
 * Load a candidate managed policy bundle (settings.json + agents/).
 * Read-only — does not modify the bundle or project.
 * @see docs/SPEC.md §7.8
 */
export async function loadManagedBundle(bundlePath: string): Promise<ManagedBundle> {
  const resolvedPath = path.resolve(bundlePath);
  if (!(await isDirectory(resolvedPath))) {
    throw new ManagedBundleError(`Managed bundle directory not found: ${resolvedPath}`);
  }

  const hasSettings = await fs
    .access(path.join(resolvedPath, "settings.json"))
    .then(() => true)
    .catch(() => false);
  const hasAgents = await isDirectory(path.join(resolvedPath, "agents"));

  if (!hasSettings && !hasAgents) {
    throw new ManagedBundleError(
      `Managed bundle must contain settings.json and/or agents/: ${resolvedPath}`,
    );
  }

  const [settings, agents] = await Promise.all([
    readManagedSettings(resolvedPath),
    discoverManagedAgents(resolvedPath),
  ]);

  return {
    bundlePath: resolvedPath,
    settingsLayer: settings.settingsLayer,
    availableModels: settings.availableModels,
    agents,
  };
}

/**
 * Apply managed bundle overlay onto a snapshot (in-memory only).
 * @see docs/SPEC.md §7.8
 */
export function applyManagedOverlay(
  snapshot: ProjectSnapshot,
  bundle: ManagedBundle,
): ProjectSnapshot {
  const mergedAgents = reconcileAgentCollisions(
    [...snapshot.agents, ...bundle.agents],
    snapshot.version.version,
  );

  const existingSettings = snapshot.settings as SettingsLayer[];
  const settings = bundle.settingsLayer
    ? [
        bundle.settingsLayer,
        ...existingSettings.filter(
          (layer) => layer.path !== bundle.settingsLayer!.path,
        ),
      ]
    : [...existingSettings];

  return {
    ...snapshot,
    agents: mergedAgents,
    settings: settings.sort((left, right) => right.priority - left.priority),
  };
}

export function resolveManagedModel(
  declaredModel: string | undefined,
  availableModels: readonly string[] | undefined,
): { declared?: string; effective?: string; substituted: boolean } {
  if (!declaredModel) {
    return { declared: undefined, effective: undefined, substituted: false };
  }

  if (!availableModels || availableModels.length === 0) {
    return { declared: declaredModel, effective: declaredModel, substituted: false };
  }

  if (availableModels.includes(declaredModel)) {
    return { declared: declaredModel, effective: declaredModel, substituted: false };
  }

  return {
    declared: declaredModel,
    effective: availableModels[0],
    substituted: true,
  };
}
