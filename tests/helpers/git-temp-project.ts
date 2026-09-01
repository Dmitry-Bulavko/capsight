import fs from "node:fs/promises";
import path from "node:path";
import { createTempDirTracker } from "./temp-dir.js";

const mkdtemp = createTempDirTracker("capsight-git-temp-");

export async function makeTempGitRepo(): Promise<string> {
  const dir = await mkdtemp();
  const resolved = await fs.realpath(dir);
  await fs.mkdir(path.join(resolved, ".git", "info"), { recursive: true });
  return resolved;
}

export async function seedClaudeAgent(repoDir: string, agentFile = "backend.md"): Promise<void> {
  const agentsDir = path.join(repoDir, ".claude", "agents");
  await fs.mkdir(agentsDir, { recursive: true });
  await fs.writeFile(
    path.join(agentsDir, agentFile),
    "---\nname: backend\ndescription: Backend agent\n---\n\nBody\n",
    "utf8",
  );
}

export async function seedProjectMcp(repoDir: string): Promise<void> {
  await fs.writeFile(
    path.join(repoDir, ".mcp.json"),
    JSON.stringify({ mcpServers: { test: { command: "echo" } } }),
    "utf8",
  );
}
