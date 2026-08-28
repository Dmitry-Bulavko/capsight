import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/server/index.js";
import { clearLastScan } from "../src/application/scan-store.js";
import { runAgents, runScan } from "../src/cli/index.js";
import { createBackup } from "../src/adapters/claude/generation/apply.js";

const SECRET = "ghp_secrettokenvalue";
const tempDirs: string[] = [];

afterEach(async () => {
  clearLastScan();
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

async function makeProjectWithSecret(): Promise<{ projectPath: string; agentPath: string }> {
  const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "capsight-redaction-"));
  tempDirs.push(projectPath);
  const agentPath = path.join(projectPath, ".claude", "agents", "leaky.md");
  await fs.mkdir(path.dirname(agentPath), { recursive: true });
  await fs.writeFile(
    agentPath,
    `---
name: leaky
description: Inline MCP server with a credential in env
mcpServers:
  - name: github
    command: npx
    env:
      GITHUB_TOKEN: ${SECRET}
---
Body
`,
  );
  return { projectPath, agentPath };
}

describe("secret redaction boundary (§13 invariant 10)", () => {
  it("keeps env values out of scan, API, CLI and backup payloads", async () => {
    const { projectPath, agentPath } = await makeProjectWithSecret();

    const scanResponse = await request(app)
      .post("/api/project/scan")
      .send({ projectPath })
      .expect(200);
    expect(JSON.stringify(scanResponse.body)).not.toContain(SECRET);

    const agentsResponse = await request(app).get("/api/agents").expect(200);
    const agentsBody = JSON.stringify(agentsResponse.body);
    expect(agentsBody).not.toContain(SECRET);
    expect(agentsBody).toContain("GITHUB_TOKEN");

    clearLastScan();
    const cliScan = await runScan(projectPath);
    expect(JSON.stringify(cliScan, null, 2)).not.toContain(SECRET);
    const cliAgents = await runAgents();
    expect(JSON.stringify(cliAgents, null, 2)).not.toContain(SECRET);

    const backup = await createBackup({
      projectPath,
      filePaths: [agentPath],
      snapshotId: cliScan.snapshot.id,
      claudeVersion: cliScan.snapshot.version,
    });
    expect(JSON.stringify(backup.manifest)).not.toContain(SECRET);
    const manifestRaw = await fs.readFile(
      path.join(backup.backupDir, "manifest.json"),
      "utf8",
    );
    expect(manifestRaw).not.toContain(SECRET);
  });
});
