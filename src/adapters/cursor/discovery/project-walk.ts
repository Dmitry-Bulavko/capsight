import fs from "node:fs/promises";
import path from "node:path";

const MAX_WALK_DEPTH = 256;

export interface ProjectScopeLevel {
  path: string;
  hasCursorDir: boolean;
  agentsPath?: string;
  skillsPath?: string;
  rulesPath?: string;
  commandsPath?: string;
  mcpPath?: string;
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
  const cursorDir = path.join(dirPath, ".cursor");
  const hasCursorDir = await isDirectory(cursorDir);

  if (!hasCursorDir) {
    return { path: dirPath, hasCursorDir: false };
  }

  const agentsCandidate = path.join(cursorDir, "agents");
  const skillsCandidate = path.join(cursorDir, "skills");
  const rulesCandidate = path.join(cursorDir, "rules");
  const commandsCandidate = path.join(cursorDir, "commands");
  const mcpCandidate = path.join(cursorDir, "mcp.json");

  const [hasAgentsDir, hasSkillsDir, hasRulesDir, hasCommandsDir, hasMcpFile] =
    await Promise.all([
      isDirectory(agentsCandidate),
      isDirectory(skillsCandidate),
      isDirectory(rulesCandidate),
      isDirectory(commandsCandidate),
      pathExists(mcpCandidate),
    ]);

  return {
    path: dirPath,
    hasCursorDir: true,
    ...(hasAgentsDir ? { agentsPath: agentsCandidate } : {}),
    ...(hasSkillsDir ? { skillsPath: skillsCandidate } : {}),
    ...(hasRulesDir ? { rulesPath: rulesCandidate } : {}),
    ...(hasCommandsDir ? { commandsPath: commandsCandidate } : {}),
    ...(hasMcpFile ? { mcpPath: mcpCandidate } : {}),
  };
}

/** @see docs/CURSOR-FACTS.md CW1–CW2 */
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
