import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { discoverSkills } from "../../../../src/adapters/claude/discovery/skills.js";
import type { ProjectScopeLevel } from "../../../../src/adapters/claude/discovery/project-walk.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

async function makeTempProject(
  structure: Record<string, string>,
): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "capsight-skills-"));
  tempDirs.push(dir);
  for (const [rel, content] of Object.entries(structure)) {
    const filePath = path.join(dir, rel);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content);
  }
  return dir;
}

function scopeLevel(dir: string, skillsPath: string): ProjectScopeLevel {
  return { path: dir, hasClaudeDir: true, skillsPath };
}

const SKILL = `---
name: vendor-lint
description: Skill attached through --add-dir
---
`;

describe("discoverSkills --add-dir (K12)", () => {
  it("gates the added directory's skills through the matrix", async () => {
    const project = await makeTempProject({
      ".claude/skills/local/SKILL.md": SKILL,
    });
    const vendor = await makeTempProject({
      ".claude/skills/vendor-lint/SKILL.md": SKILL,
    });
    const scopes = [
      scopeLevel(project, path.join(project, ".claude", "skills")),
    ];

    const skills = await discoverSkills(scopes, project, [vendor], "2.1.240");
    const attached = skills.find((skill) => skill.source.scope === "unknown");

    expect(attached?.enforcement).toBe("enforced");
    expect(attached?.source.matrixRef).toBe("discovery.addDirSkills");

    // Skills found on the ordinary scope walk are backed by no entry and are
    // not gated, so they claim no confidence either way.
    const local = skills.find((skill) => skill.source.scope === "project");
    expect(local?.enforcement).toBeUndefined();
    expect(local?.source.matrixRef).toBeUndefined();
  });

  it("reports the added skills as undetermined in degraded mode (§8.3)", async () => {
    const project = await makeTempProject({
      ".claude/skills/local/SKILL.md": SKILL,
    });
    const vendor = await makeTempProject({
      ".claude/skills/vendor-lint/SKILL.md": SKILL,
    });
    const scopes = [
      scopeLevel(project, path.join(project, ".claude", "skills")),
    ];

    const skills = await discoverSkills(scopes, project, [vendor]);
    const attached = skills.find((skill) => skill.source.scope === "unknown");

    // The file was read; that the platform attaches it is the unfounded claim.
    expect(attached).toBeDefined();
    expect(attached?.enforcement).toBe("unknown");
  });
});
