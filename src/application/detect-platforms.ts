/**
 * Evidence-based multi-platform presence detection.
 * @see docs/COMPAT-FACTS.md, docs/tasks/EC-02-multi-platform-scan.md
 */

import fs from "node:fs/promises";
import path from "node:path";
import { PLATFORM_IDS, type PlatformId } from "../adapters/platform.js";
import { RESOURCE_CLASS, type ResourceClass } from "../core/compat/resource-class.js";
import type { PlatformDetection, SourceInfo } from "../core/model/index.js";

const MAX_WALK_DEPTH = 256;
const MAX_DIR_SCAN_DEPTH = 12;

const SKIP_DIR_NAMES = new Set([
  ".git",
  "node_modules",
  ".next",
  "dist",
  "build",
  "coverage",
  ".turbo",
]);

export interface DetectPlatformsResult {
  projectPath: string;
  platforms: PlatformDetection[];
}

interface ArtifactHit {
  platforms: readonly PlatformId[];
  resourceClass: ResourceClass;
  filePath: string;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function isRegularFile(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function walkScopeDirectories(startPath: string): Promise<string[]> {
  const resolved = path.resolve(startPath);
  const scopes: string[] = [];
  let current = resolved;
  let depth = 0;

  while (depth < MAX_WALK_DEPTH) {
    scopes.push(current);
    const gitMarker = path.join(current, ".git");
    if (await pathExists(gitMarker)) {
      break;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
    depth += 1;
  }

  return scopes;
}

async function collectMarkdownFiles(
  dirPath: string,
  maxDepth = MAX_DIR_SCAN_DEPTH,
): Promise<string[]> {
  const results: string[] = [];

  async function walk(current: string, depth: number): Promise<void> {
    if (depth > maxDepth) {
      return;
    }
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIR_NAMES.has(entry.name)) {
          continue;
        }
        await walk(fullPath, depth + 1);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(".md")) {
        results.push(fullPath);
      }
    }
  }

  if (await isDirectory(dirPath)) {
    await walk(dirPath, 0);
  }

  return results;
}

async function collectMdcFiles(
  dirPath: string,
  maxDepth = MAX_DIR_SCAN_DEPTH,
): Promise<string[]> {
  const results: string[] = [];

  async function walk(current: string, depth: number): Promise<void> {
    if (depth > maxDepth) {
      return;
    }
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIR_NAMES.has(entry.name)) {
          continue;
        }
        await walk(fullPath, depth + 1);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(".mdc")) {
        results.push(fullPath);
      }
    }
  }

  if (await isDirectory(dirPath)) {
    await walk(dirPath, 0);
  }

  return results;
}

async function collectSkillDirectories(skillsRoot: string): Promise<string[]> {
  const results: string[] = [];
  if (!(await isDirectory(skillsRoot))) {
    return results;
  }

  let entries;
  try {
    entries = await fs.readdir(skillsRoot, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const skillFile = path.join(skillsRoot, entry.name, "SKILL.md");
    if (await isRegularFile(skillFile)) {
      results.push(skillFile);
    }
  }

  return results;
}

function scopeForPath(filePath: string, projectPath: string): SourceInfo["scope"] {
  const relative = path.relative(projectPath, filePath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    return "nested-project";
  }
  return "project";
}

function sourceEvidence(
  platform: PlatformId,
  filePath: string,
  projectPath: string,
  resourceClass: ResourceClass,
): SourceInfo {
  return {
    platform,
    path: filePath,
    scope: scopeForPath(filePath, projectPath),
    matrixRef: resourceClass,
  };
}

async function collectArtifactHits(projectPath: string): Promise<ArtifactHit[]> {
  const resolvedProject = path.resolve(projectPath);
  const hits: ArtifactHit[] = [];
  const scopes = await walkScopeDirectories(resolvedProject);

  for (const scopeDir of scopes) {
    const agentsMd = path.join(scopeDir, "AGENTS.md");
    if (await isRegularFile(agentsMd)) {
      hits.push({
        platforms: ["cursor", "codex"],
        resourceClass: RESOURCE_CLASS.INSTRUCTION_AGENTS_MD,
        filePath: agentsMd,
      });
    }

    const agentsOverride = path.join(scopeDir, "AGENTS.override.md");
    if (await isRegularFile(agentsOverride)) {
      hits.push({
        platforms: ["codex"],
        resourceClass: RESOURCE_CLASS.INSTRUCTION_AGENTS_OVERRIDE_MD,
        filePath: agentsOverride,
      });
    }

    const claudeMd = path.join(scopeDir, "CLAUDE.md");
    if (await isRegularFile(claudeMd)) {
      hits.push({
        platforms: ["claude"],
        resourceClass: RESOURCE_CLASS.INSTRUCTION_CLAUDE_MD,
        filePath: claudeMd,
      });
    }

    const claudeLocalMd = path.join(scopeDir, "CLAUDE.local.md");
    if (await isRegularFile(claudeLocalMd)) {
      hits.push({
        platforms: ["claude"],
        resourceClass: RESOURCE_CLASS.INSTRUCTION_CLAUDE_LOCAL_MD,
        filePath: claudeLocalMd,
      });
    }

    const mcpJson = path.join(scopeDir, ".mcp.json");
    if (await isRegularFile(mcpJson)) {
      hits.push({
        platforms: ["claude"],
        resourceClass: RESOURCE_CLASS.MCP_JSON_CONFIG,
        filePath: mcpJson,
      });
    }
  }

  const cursorRules = path.join(resolvedProject, ".cursorrules");
  if (await isRegularFile(cursorRules)) {
    hits.push({
      platforms: ["cursor"],
      resourceClass: RESOURCE_CLASS.INSTRUCTION_CURSORRULES,
      filePath: cursorRules,
    });
  }

  const claudeDir = path.join(resolvedProject, ".claude");
  if (await isDirectory(claudeDir)) {
    for (const filePath of await collectMarkdownFiles(path.join(claudeDir, "agents"))) {
      hits.push({
        platforms: ["claude"],
        resourceClass: RESOURCE_CLASS.AGENT_MARKDOWN,
        filePath,
      });
    }

    for (const filePath of await collectMarkdownFiles(path.join(claudeDir, "commands"))) {
      hits.push({
        platforms: ["claude"],
        resourceClass: RESOURCE_CLASS.COMMAND_MARKDOWN,
        filePath,
      });
    }

    for (const filePath of await collectSkillDirectories(path.join(claudeDir, "skills"))) {
      hits.push({
        platforms: ["claude"],
        resourceClass: RESOURCE_CLASS.SKILL_DIRECTORY,
        filePath,
      });
    }

    for (const settingsName of ["settings.json", "settings.local.json"]) {
      const settingsPath = path.join(claudeDir, settingsName);
      if (await isRegularFile(settingsPath)) {
        hits.push({
          platforms: ["claude"],
          resourceClass: RESOURCE_CLASS.SETTINGS_JSON,
          filePath: settingsPath,
        });
      }
    }
  }

  const cursorDir = path.join(resolvedProject, ".cursor");
  if (await isDirectory(cursorDir)) {
    for (const filePath of await collectMarkdownFiles(path.join(cursorDir, "agents"))) {
      hits.push({
        platforms: ["cursor"],
        resourceClass: RESOURCE_CLASS.AGENT_MARKDOWN,
        filePath,
      });
    }

    for (const filePath of await collectMarkdownFiles(path.join(cursorDir, "commands"))) {
      hits.push({
        platforms: ["cursor"],
        resourceClass: RESOURCE_CLASS.COMMAND_MARKDOWN,
        filePath,
      });
    }

    for (const filePath of await collectSkillDirectories(path.join(cursorDir, "skills"))) {
      hits.push({
        platforms: ["cursor"],
        resourceClass: RESOURCE_CLASS.SKILL_DIRECTORY,
        filePath,
      });
    }

    for (const filePath of await collectMdcFiles(path.join(cursorDir, "rules"))) {
      hits.push({
        platforms: ["cursor"],
        resourceClass: RESOURCE_CLASS.INSTRUCTION_RULE_MDC,
        filePath,
      });
    }

    const cursorMcp = path.join(cursorDir, "mcp.json");
    if (await isRegularFile(cursorMcp)) {
      hits.push({
        platforms: ["cursor"],
        resourceClass: RESOURCE_CLASS.MCP_JSON_CONFIG,
        filePath: cursorMcp,
      });
    }
  }

  const codexConfig = path.join(resolvedProject, ".codex", "config.toml");
  if (await isRegularFile(codexConfig)) {
    hits.push({
      platforms: ["codex"],
      resourceClass: RESOURCE_CLASS.SETTINGS_TOML,
      filePath: codexConfig,
    });
  }

  for (const filePath of await collectSkillDirectories(
    path.join(resolvedProject, ".agents", "skills"),
  )) {
    hits.push({
      platforms: ["codex"],
      resourceClass: RESOURCE_CLASS.SKILL_DIRECTORY,
      filePath,
    });
  }

  return hits;
}

export async function detectPlatforms(projectPath: string): Promise<PlatformDetection[]> {
  const resolvedProject = path.resolve(projectPath);
  const hits = await collectArtifactHits(resolvedProject);

  const evidenceByPlatform = new Map<PlatformId, SourceInfo[]>();
  for (const platform of PLATFORM_IDS) {
    evidenceByPlatform.set(platform, []);
  }

  for (const hit of hits) {
    for (const platform of hit.platforms) {
      evidenceByPlatform.get(platform)!.push(
        sourceEvidence(platform, hit.filePath, resolvedProject, hit.resourceClass),
      );
    }
  }

  return PLATFORM_IDS.map((platform) => {
    const evidence = evidenceByPlatform.get(platform)!;
    return {
      platform,
      status: evidence.length > 0 ? "detected" : "not-detected",
      evidence,
    };
  });
}

export async function detectPlatformsWithPath(
  projectPath: string,
): Promise<DetectPlatformsResult> {
  return {
    projectPath: path.resolve(projectPath),
    platforms: await detectPlatforms(projectPath),
  };
}
