import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ClaudeAgent as Agent } from "../../../../src/adapters/claude/model/index.js";
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

    // A3 exists from 2.1.178; below that the matrix does not found a winner.
    const { agents } = await discoverAgents(scopes, appPath, [], "2.1.178");
    const nested = agents.find(
      (a) => a.name === "shared" && a.source.path?.includes("packages"),
    );
    const parent = agents.find(
      (a: Agent) => a.name === "shared" && a.source.path === path.join(root, ".claude", "agents", "shared.md"),
    );

    expect(nested?.status).toBe("active");
    expect(parent?.status).toBe("shadowed");
    expect(parent?.collision?.matrixRef).toBe("agent.collisionNested");
    expect(parent?.collision?.enforcement).toBe("enforced");
  });

  it("names no A3 winner below the version the rule appears in", async () => {
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
    const scopes: ProjectScopeLevel[] = [
      scopeLevel(appPath, path.join(appPath, ".claude", "agents")),
      scopeLevel(root, path.join(root, ".claude", "agents")),
    ];

    for (const version of ["2.1.177", "unknown"]) {
      const { agents } = await discoverAgents(scopes, appPath, [], version);
      const shared = agents.filter((a: Agent) => a.name === "shared");

      expect(shared).toHaveLength(2);
      for (const agent of shared) {
        expect(agent.status, version).toBe("ambiguous");
        expect(agent.collision?.effective, version).toBeUndefined();
        expect(agent.collision?.enforcement, version).toBe("unknown");
        expect(agent.collision?.matrixRef, version).toBe("agent.collisionNested");
      }
    }
  });

  it("keeps an A4 same-directory collision winner-free on every version", async () => {
    const project = await makeTempProject({
      ".claude/agents/reviewer.md": `---
name: reviewer
description: One copy
---
`,
      ".claude/agents/extra/duplicate.md": `---
name: reviewer
description: Another copy in the same agents root
---
`,
    });
    const agentsPath = path.join(project, ".claude", "agents");

    const { agents } = await discoverAgents(
      [scopeLevel(project, agentsPath)],
      project,
      [],
      "2.1.240",
    );

    const reviewers = agents.filter((a: Agent) => a.name === "reviewer");
    expect(reviewers).toHaveLength(2);
    for (const agent of reviewers) {
      expect(agent.status).toBe("ambiguous");
      expect(agent.collision?.effective).toBeUndefined();
      // A4's entry is `unknown` by construction: one file loads, but not which.
      expect(agent.collision?.enforcement).toBe("unknown");
      expect(agent.collision?.matrixRef).toBe("agent.collisionSameDir");
    }
  });

  it("reports an --add-dir agent as unknown when A9 is not founded (A9)", async () => {
    const project = await makeTempProject({
      ".claude/agents/reviewer.md": `---
name: reviewer
description: Project agent
---
`,
    });
    const vendor = await makeTempProject({
      ".claude/agents/vendor.md": `---
name: vendor
description: Agent attached through --add-dir
---
`,
    });
    const agentsPath = path.join(project, ".claude", "agents");
    const scopes = [scopeLevel(project, agentsPath)];

    const detected = await discoverAgents(scopes, project, [vendor], "2.1.240");
    const attached = detected.agents.find((a: Agent) => a.name === "vendor");
    expect(attached?.status).toBe("active");
    expect(attached?.source.matrixRef).toBe("discovery.addDirAgents");

    // §8.3: without a detected version the platform claim behind A9 has no
    // basis, so the agent is reported as unknown rather than active.
    const degraded = await discoverAgents(scopes, project, [vendor]);
    expect(degraded.agents.find((a: Agent) => a.name === "vendor")?.status).toBe(
      "unknown",
    );
    // The ordinary scope walk is not gated and keeps its status.
    expect(degraded.agents.find((a: Agent) => a.name === "reviewer")?.status).toBe(
      "active",
    );
  });
});

describe("discoverAgents secret redaction (§0.1.8, §13 invariant 10)", () => {
  const agentWithSecrets = `---
name: leaky
description: Declares inline MCP with credentials
mcpServers:
  - name: github
    command: /usr/local/bin/npx
    args: ["-y", "@modelcontextprotocol/server-github", "--token=ghp_argtoken"]
    env:
      GITHUB_TOKEN: ghp_envtoken
      OTHER: plain
  - name: remote
    url: https://mcp.example.com/sse
    headers:
      Authorization: "Bearer sk-headertoken"
  - github-named
hooks:
  PreToolUse:
    - matcher: Bash
      hooks:
        - type: command
          command: "curl -H 'Authorization: Bearer ghp_hooktoken' https://example.com"
customField:
  apiKey: sk-unknownfieldtoken
otherCustom: sk-scalarunknown
---
Body
`;

  async function discoverLeaky(): Promise<Agent> {
    const project = await makeTempProject({ ".claude/agents/leaky.md": agentWithSecrets });
    const agentsPath = path.join(project, ".claude", "agents");
    const { agents } = await discoverAgents([scopeLevel(project, agentsPath)], project);
    const agent = agents.find((a) => a.name === "leaky");
    expect(agent).toBeDefined();
    return agent!;
  }

  it("reduces inline MCP definitions to key names only", async () => {
    const agent = await discoverLeaky();
    expect(agent.configuration.mcpServers).toEqual([
      {
        name: "github",
        transport: "stdio",
        commandName: "npx",
        envKeys: ["GITHUB_TOKEN", "OTHER"],
        headerKeys: [],
      },
      {
        name: "remote",
        transport: "sse",
        envKeys: [],
        headerKeys: ["Authorization"],
      },
      "github-named",
    ]);
  });

  it("reduces hooks to a structural summary", async () => {
    const agent = await discoverLeaky();
    expect(agent.configuration.hooks).toEqual({
      form: "object",
      events: ["PreToolUse"],
      count: 1,
    });
  });

  it("keeps unknown field names and value types, never values (§8.2)", async () => {
    const agent = await discoverLeaky();
    expect(agent.configuration.unknownFields).toEqual({
      customField: "object",
      otherCustom: "string",
    });
  });

  it("never carries secret values in the serialized agent", async () => {
    const agent = await discoverLeaky();
    const serialized = JSON.stringify(agent);
    for (const secret of [
      "ghp_envtoken",
      "ghp_argtoken",
      "sk-headertoken",
      "ghp_hooktoken",
      "sk-unknownfieldtoken",
      "sk-scalarunknown",
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });
});
