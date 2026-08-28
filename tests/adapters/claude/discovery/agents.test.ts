import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Agent } from "../../../../src/core/model/index.js";
import { discoverAgents } from "../../../../src/adapters/claude/discovery/agents.js";
import type { ProjectScopeLevel } from "../../../../src/adapters/claude/discovery/project-walk.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

async function makeTempProject(structure: Record<string, string>): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "capsight-agents-"));
  tempDirs.push(dir);
  for (const [rel, content] of Object.entries(structure)) {
    const filePath = path.join(dir, rel);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content);
  }
  return dir;
}

function scopeLevel(dir: string, agentsPath?: string): ProjectScopeLevel {
  return {
    path: dir,
    hasClaudeDir: true,
    agentsPath,
  };
}

describe("discoverAgents", () => {
  it("discovers valid project agent", async () => {
    const project = await makeTempProject({
      ".claude/agents/reviewer.md": `---
name: reviewer
description: Reviews code
---
Prompt body
`,
    });
    const agentsPath = path.join(project, ".claude", "agents");
    const { agents } = await discoverAgents([scopeLevel(project, agentsPath)], project);
    const active = agents.find((a) => a.name === "reviewer");
    expect(active?.status).toBe("active");
    expect(active?.source.scope).toBe("project");
  });

  it("marks invalid agents with reason", async () => {
    const project = await makeTempProject({
      ".claude/agents/no-desc.md": `---
name: nodesc
---
Body
`,
      ".claude/agents/bad-name.md": `---
name: bad:name
description: Bad
---
`,
    });
    const agentsPath = path.join(project, ".claude", "agents");
    const { agents } = await discoverAgents([scopeLevel(project, agentsPath)], project);
    expect(agents.some((a) => a.invalidReason === "no-description")).toBe(true);
    expect(agents.some((a) => a.invalidReason === "bad-name-chars")).toBe(true);
  });

  it("marks same-directory name collision as ambiguous", async () => {
    const project = await makeTempProject({
      ".claude/agents/dupe/a.md": `---
name: dupe
description: First
---
`,
      ".claude/agents/dupe/nested/b.md": `---
name: dupe
description: Second
---
`,
    });
    const agentsPath = path.join(project, ".claude", "agents");
    const { agents } = await discoverAgents([scopeLevel(project, agentsPath)], project);
    const dupes = agents.filter((a) => a.name === "dupe");
    expect(dupes.every((a) => a.status === "ambiguous")).toBe(true);
    expect(dupes[0]?.collision?.rule).toBe("A4");
  });

  it("prefers closest nested-project agent over parent", async () => {
    const root = await makeTempProject({
      ".claude/agents/shared.md": `---
name: shared
description: Parent copy
---
`,
      "packages/app/.claude/agents/shared.md": `---
name: shared
description: Nested copy
---
`,
    });

    const appPath = path.join(root, "packages", "app");
    const parentAgents = path.join(root, ".claude", "agents");
    const nestedAgents = path.join(appPath, ".claude", "agents");

    const scopes: ProjectScopeLevel[] = [
      scopeLevel(appPath, nestedAgents),
      scopeLevel(root, parentAgents),
    ];

    const { agents } = await discoverAgents(scopes, appPath);
    const nested = agents.find(
      (a) => a.name === "shared" && a.source.path?.includes("packages"),
    );
    const parent = agents.find(
      (a: Agent) => a.name === "shared" && a.source.path === path.join(root, ".claude", "agents", "shared.md"),
    );

    expect(nested?.status).toBe("active");
    expect(parent?.status).toBe("shadowed");
  });
});
