import fs from "node:fs/promises";
import path from "node:path";

const MAX_WALK_DEPTH = 256;

export interface ProjectScopeLevel {
  path: string;
  hasCodexDir: boolean;
  codexConfigPath?: string;
  agentsSkillsPath?: string;
  agentsMdPath?: string;
  agentsOverridePath?: string;
}

export interface WalkProjectScopesResult {
  projectPath: string;
  repoRoot: string;
  scopes: ProjectScopeLevel[];
}

async function isDirectory(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function inspectScopeLevel(dirPath: string): Promise<ProjectScopeLevel> {
  const codexDir = path.join(dirPath, ".codex");
  const hasCodexDir = await isDirectory(codexDir);
  const codexConfigPath = path.join(codexDir, "config.toml");
  const agentsSkillsPath = path.join(dirPath, ".agents", "skills");
  const agentsMdPath = path.join(dirPath, "AGENTS.md");
  const agentsOverridePath = path.join(dirPath, "AGENTS.override.md");

  const [hasCodexConfig, hasAgentsSkills, hasAgentsMd, hasAgentsOverride] = await Promise.all([
    pathExists(codexConfigPath),
    isDirectory(agentsSkillsPath),
    pathExists(agentsMdPath),
    pathExists(agentsOverridePath),
  ]);

  return {
    path: dirPath,
    hasCodexDir,
    ...(hasCodexConfig ? { codexConfigPath } : {}),
    ...(hasAgentsSkills ? { agentsSkillsPath } : {}),
    ...(hasAgentsMd ? { agentsMdPath } : {}),
    ...(hasAgentsOverride ? { agentsOverridePath } : {}),
  };
}

/** @see docs/CODEX-FACTS.md XR1–XR3 */
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

/** Scopes ordered root → cwd (repo root first, project path last). */
export function scopesRootToCwd(walk: WalkProjectScopesResult): ProjectScopeLevel[] {
  const resolvedRoot = path.resolve(walk.repoRoot);
  const rootIndex = walk.scopes.findIndex(
    (scope) => path.resolve(scope.path) === resolvedRoot,
  );
  const chain = rootIndex >= 0 ? walk.scopes.slice(0, rootIndex + 1) : walk.scopes;
  return [...chain].reverse();
}
