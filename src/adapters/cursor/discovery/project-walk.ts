import fs from "node:fs/promises";
import path from "node:path";

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

/** @see docs/CURSOR-FACTS.md CW2, CW5 */
export async function walkProjectScopes(
  startPath: string,
): Promise<WalkProjectScopesResult> {
  const projectPath = path.resolve(startPath);

  if (!(await isDirectory(projectPath))) {
    throw new Error(`Project path is not a directory: ${projectPath}`);
  }

  return {
    projectPath,
    scopes: [await inspectScopeLevel(projectPath)],
  };
}
