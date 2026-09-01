import fs from "node:fs/promises";
import path from "node:path";
import { isDirectory, pathExists } from "../../shared/fs.js";

/** Maximum parent hops to avoid infinite loops on pathological layouts. */
const MAX_WALK_DEPTH = 256;

export interface ProjectScopeLevel {
  /** Absolute path to this directory level. */
  path: string;
  /** Whether a `.claude/` directory exists at this level. */
  hasClaudeDir: boolean;
  /** Absolute path to `.claude/agents/` when that directory exists. */
  agentsPath?: string;
  /** Absolute path to `.claude/skills/` when that directory exists. */
  skillsPath?: string;
}

export interface WalkProjectScopesResult {
  /** Normalized absolute start path. */
  projectPath: string;
  /**
   * Directory containing `.git` when found walking upward;
   * otherwise the normalized start path.
   */
  repoRoot: string;
  /** Scope levels from start path upward, inclusive of the stop directory. */
  scopes: ProjectScopeLevel[];
}

async function inspectScopeLevel(dirPath: string): Promise<ProjectScopeLevel> {
  const claudeDir = path.join(dirPath, ".claude");
  const hasClaudeDir = await isDirectory(claudeDir);

  if (!hasClaudeDir) {
    return { path: dirPath, hasClaudeDir: false };
  }

  const agentsCandidate = path.join(claudeDir, "agents");
  const skillsCandidate = path.join(claudeDir, "skills");

  const [hasAgentsDir, hasSkillsDir] = await Promise.all([
    isDirectory(agentsCandidate),
    isDirectory(skillsCandidate),
  ]);

  return {
    path: dirPath,
    hasClaudeDir: true,
    ...(hasAgentsDir ? { agentsPath: agentsCandidate } : {}),
    ...(hasSkillsDir ? { skillsPath: skillsCandidate } : {}),
  };
}

/**
 * Walk upward from `startPath` to the repo root (directory containing `.git`)
 * or the filesystem root, collecting `.claude/` scope metadata at each level.
 * Read-only filesystem operations only.
 */
export async function walkProjectScopes(
  startPath: string,
): Promise<WalkProjectScopesResult> {
  const projectPath = path.resolve(startPath);

  if (!(await isDirectory(projectPath))) {
    throw new Error(`Project path is not a directory: ${projectPath}`);
  }

  const scopes: ProjectScopeLevel[] = [];
  let current = projectPath;
  let repoRoot: string | undefined;
  let depth = 0;

  while (depth < MAX_WALK_DEPTH) {
    scopes.push(await inspectScopeLevel(current));

    const gitPath = path.join(current, ".git");
    if (await pathExists(gitPath)) {
      repoRoot = current;
      break;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }

    current = parent;
    depth += 1;
  }

  return {
    projectPath,
    repoRoot: repoRoot ?? projectPath,
    scopes,
  };
}
