import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import type { Scope } from "../../../core/model/index.js";
import {
  getBooleanField,
  getStringArrayField,
  getStringField,
  parseFrontmatter,
} from "../parsing/frontmatter.js";
import type { ProjectScopeLevel } from "./project-walk.js";
import type { DiscoveredInstruction } from "./types.js";

async function fileStat(filePath: string): Promise<{ sizeBytes: number } | null> {
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      return null;
    }
    return { sizeBytes: stat.size };
  } catch {
    return null;
  }
}

function instructionId(filePath: string): string {
  return createHash("sha256").update(`instruction:${filePath}`).digest("hex").slice(0, 16);
}

async function collectMdcFiles(rootDir: string): Promise<string[]> {
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
      } else if (entry.isFile() && entry.name.endsWith(".mdc")) {
        results.push(fullPath);
      }
    }
  }

  await walk(rootDir);
  return results.sort();
}

/** Plain `.md` files under rules/ — ignored by Cursor (CR4). */
async function collectIgnoredMdFiles(rootDir: string): Promise<string[]> {
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
      } else if (
        entry.isFile() &&
        entry.name.endsWith(".md") &&
        !entry.name.endsWith(".mdc")
      ) {
        results.push(fullPath);
      }
    }
  }

  await walk(rootDir);
  return results.sort();
}

/**
 * Paths of plain `.md` rule files Cursor ignores. Used for CR4 warnings.
 * @see docs/CURSOR-FACTS.md CR4
 */
export async function discoverIgnoredRuleFiles(
  projectScopes: ProjectScopeLevel[],
  projectPath: string,
): Promise<Array<{ path: string; scope: Scope }>> {
  const ignored: Array<{ path: string; scope: Scope }> = [];
  const resolvedProject = path.resolve(projectPath);

  for (const scope of projectScopes) {
    if (!scope.rulesPath) {
      continue;
    }
    const scopeType: Scope =
      path.resolve(scope.path) === resolvedProject ? "project" : "nested-project";
    for (const filePath of await collectIgnoredMdFiles(scope.rulesPath)) {
      ignored.push({ path: filePath, scope: scopeType });
    }
  }

  return ignored;
}

async function parseRuleFile(
  filePath: string,
  scope: Scope,
): Promise<DiscoveredInstruction | null> {
  const stat = await fileStat(filePath);
  if (!stat) {
    return null;
  }

  let description: string | undefined;
  let alwaysApply: boolean | undefined;
  let globs: string[] | undefined;

  try {
    const content = await fs.readFile(filePath, "utf8");
    const parsed = parseFrontmatter(content);
    if (parsed.ok) {
      description = getStringField(parsed.data, "description");
      alwaysApply = getBooleanField(parsed.data, "alwaysApply");
      globs = getStringArrayField(parsed.data, "globs");
    }
  } catch {
    // Size-only discovery still succeeds when frontmatter cannot be read.
  }

  return {
    id: instructionId(filePath),
    type: "rule",
    path: filePath,
    scope,
    sizeBytes: stat.sizeBytes,
    ...(description !== undefined ? { description } : {}),
    ...(alwaysApply !== undefined ? { alwaysApply } : {}),
    ...(globs !== undefined ? { globs } : {}),
  };
}

/** @see docs/CURSOR-FACTS.md CR1–CR3, CW3 */
export async function discoverInstructions(
  projectScopes: ProjectScopeLevel[],
  projectPath: string,
): Promise<DiscoveredInstruction[]> {
  const instructions: DiscoveredInstruction[] = [];
  const resolvedProject = path.resolve(projectPath);

  for (const scope of projectScopes) {
    const scopeType: Scope =
      path.resolve(scope.path) === resolvedProject ? "project" : "nested-project";

    const agentsMdPath = path.join(scope.path, "AGENTS.md");
    const agentsStat = await fileStat(agentsMdPath);
    if (agentsStat) {
      instructions.push({
        id: instructionId(agentsMdPath),
        type: "AGENTS.md",
        path: agentsMdPath,
        scope: scopeType,
        sizeBytes: agentsStat.sizeBytes,
      });
    }

    if (scope.rulesPath) {
      for (const rulePath of await collectMdcFiles(scope.rulesPath)) {
        const rule = await parseRuleFile(rulePath, scopeType);
        if (rule) {
          instructions.push(rule);
        }
      }
    }
  }

  const cursorRulesPath = path.join(resolvedProject, ".cursorrules");
  const cursorRulesStat = await fileStat(cursorRulesPath);
  if (cursorRulesStat) {
    instructions.push({
      id: instructionId(cursorRulesPath),
      type: "cursorrules",
      path: cursorRulesPath,
      scope: "project",
      sizeBytes: cursorRulesStat.sizeBytes,
    });
  }

  return instructions;
}
