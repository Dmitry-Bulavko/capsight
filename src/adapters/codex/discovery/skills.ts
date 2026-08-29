import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import type { Scope, SourceInfo } from "../../../core/model/index.js";
import { CODEX_PLATFORM } from "../model/index.js";
import { getStringField, parseFrontmatter } from "../parsing/frontmatter.js";
import type { ProjectScopeLevel } from "./project-walk.js";
import type { DiscoveredSkill } from "./types.js";

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
  return { platform: CODEX_PLATFORM, scope, path: filePath };
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
      kind: "skill",
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

/** @see docs/CODEX-FACTS.md XS1, XS2 */
export async function discoverSkills(
  projectScopes: ProjectScopeLevel[],
  projectPath: string,
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
    if (!scope.agentsSkillsPath) {
      continue;
    }
    const scopeType: Scope =
      path.resolve(scope.path) === resolvedProject ? "project" : "nested-project";
    for (const skill of await discoverFromSkillsDir(scope.agentsSkillsPath, scopeType)) {
      addSkill(skill);
    }
  }

  return skills;
}
