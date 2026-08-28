import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import os from "node:os";
import type { Scope, SourceInfo } from "../../../core/model/index.js";
import { getStringField, parseFrontmatter } from "../parsing/frontmatter.js";
import type { ProjectScopeLevel } from "./project-walk.js";
import type { DiscoveredSkill } from "./types.js";

async function isDirectory(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function skillId(filePath: string): string {
  return createHash("sha256").update(`skill:${filePath}`).digest("hex").slice(0, 16);
}

function source(scope: Scope, filePath: string): SourceInfo {
  return { platform: "claude", scope, path: filePath };
}

async function parseSkillFile(
  filePath: string,
  scope: Scope,
  nameOverride?: string,
): Promise<DiscoveredSkill | null> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    const parsed = parseFrontmatter(content);
    if (!parsed.ok) {
      return null;
    }
    const name =
      nameOverride ??
      getStringField(parsed.data, "name") ??
      path.basename(path.dirname(filePath));
    const description = getStringField(parsed.data, "description");
    return {
      id: skillId(filePath),
      name,
      description,
      source: source(scope, filePath),
      path: filePath,
    };
  } catch {
    return null;
  }
}

async function discoverFromSkillsDir(
  skillsDir: string,
  scope: Scope,
): Promise<DiscoveredSkill[]> {
  const skills: DiscoveredSkill[] = [];
  let entries;
  try {
    entries = await fs.readdir(skillsDir, { withFileTypes: true });
  } catch {
    return skills;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const skillMd = path.join(skillsDir, entry.name, "SKILL.md");
    if (await fileExists(skillMd)) {
      const skill = await parseSkillFile(skillMd, scope, entry.name);
      if (skill) {
        skills.push(skill);
      }
    }
  }

  return skills;
}

async function discoverCommands(
  commandsDir: string,
  scope: Scope,
): Promise<DiscoveredSkill[]> {
  const skills: DiscoveredSkill[] = [];
  if (!(await isDirectory(commandsDir))) {
    return skills;
  }

  let entries;
  try {
    entries = await fs.readdir(commandsDir, { withFileTypes: true });
  } catch {
    return skills;
  }

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      const filePath = path.join(commandsDir, entry.name);
      const skill = await parseSkillFile(
        filePath,
        scope,
        path.basename(entry.name, ".md"),
      );
      if (skill) {
        skills.push(skill);
      }
    }
  }

  return skills;
}

export async function discoverSkills(
  projectScopes: ProjectScopeLevel[],
  projectPath: string,
  addDirs: string[] = [],
): Promise<DiscoveredSkill[]> {
  const skills: DiscoveredSkill[] = [];
  const seen = new Set<string>();
  const resolvedProject = path.resolve(projectPath);

  const addSkill = (skill: DiscoveredSkill) => {
    const key = `${skill.source.scope}:${skill.name}`;
    if (!seen.has(key)) {
      seen.add(key);
      skills.push(skill);
    }
  };

  for (const scope of projectScopes) {
    if (!scope.hasClaudeDir) {
      continue;
    }
    const scopeType: Scope =
      path.resolve(scope.path) === resolvedProject ? "project" : "nested-project";
    const claudeDir = path.join(scope.path, ".claude");

    if (scope.skillsPath) {
      for (const skill of await discoverFromSkillsDir(scope.skillsPath, scopeType)) {
        addSkill(skill);
      }
    }

    for (const skill of await discoverCommands(path.join(claudeDir, "commands"), scopeType)) {
      addSkill(skill);
    }
  }

  const userSkills = path.join(os.homedir(), ".claude", "skills");
  for (const skill of await discoverFromSkillsDir(userSkills, "user")) {
    addSkill(skill);
  }

  for (const addDir of addDirs) {
    const skillsPath = path.join(path.resolve(addDir), ".claude", "skills");
    for (const skill of await discoverFromSkillsDir(skillsPath, "unknown")) {
      addSkill(skill);
    }
  }

  return skills;
}
