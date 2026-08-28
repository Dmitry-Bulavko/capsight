import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyConfiguration, rollbackConfiguration } from "../../src/application/apply.js";
import { resetLocalStateNotices } from "../../src/application/local-state-notice.js";
import { scan } from "../../src/application/scan.js";
import { clearLastScan, setLastScan } from "../../src/application/scan-store.js";

const tempDirs: string[] = [];

beforeEach(() => {
  resetLocalStateNotices();
  clearLastScan();
});

afterEach(async () => {
  resetLocalStateNotices();
  clearLastScan();
  await Promise.all(
    tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

/** A temp project that is its own git repository, so ignore rules are meaningful. */
async function makeTempProject(): Promise<string> {
  const created = await fs.mkdtemp(path.join(os.tmpdir(), "capsight-local-state-apply-"));
  tempDirs.push(created);
  const dir = await fs.realpath(created);
  await fs.mkdir(path.join(dir, ".git", "info"), { recursive: true });
  await fs.mkdir(path.join(dir, ".claude", "agents"), { recursive: true });
  await fs.writeFile(
    path.join(dir, ".claude", "agents", "backend.md"),
    `---
name: backend
description: Backend agent
tools:
  - Read
  - Grep
---

You are a backend developer.
`,
  );
  return dir;
}

async function applyOnce(
  projectPath: string,
  tool: string,
): Promise<Awaited<ReturnType<typeof applyConfiguration>>> {
  const scanResult = await scan({ projectPath });
  setLastScan(scanResult);
  const agent = scanResult.snapshot.agents.find((entry) => entry.name === "backend");
  expect(agent).toBeDefined();
  return applyConfiguration({
    pending: { byAgent: { [agent!.id]: { [tool]: true } } },
    editSnapshotId: scanResult.snapshot.id,
    confirmed: true,
    projectPath,
  });
}

describe("applyConfiguration() local-state warning", () => {
  it("warns on the first write into .agent-manager/ and names the directory", async () => {
    const projectPath = await makeTempProject();

    const result = await applyOnce(projectPath, "Write");

    expect(result.localStateWarning).toBeDefined();
    expect(result.localStateWarning!.code).toBe("local-state-not-ignored");
    expect(result.localStateWarning!.directory).toBe(path.join(projectPath, ".agent-manager"));
    expect(result.localStateWarning!.message).toContain(".agent-manager/");
  });

  it("does not repeat the warning on later writes", async () => {
    const projectPath = await makeTempProject();

    expect((await applyOnce(projectPath, "Write")).localStateWarning).toBeDefined();

    const second = await applyOnce(projectPath, "Edit");
    // A real second write, not a no-op apply that returns early.
    expect(second.files.length).toBeGreaterThan(0);
    expect(second.localStateWarning).toBeUndefined();

    // Also silent for a fresh process, because the directory now exists.
    resetLocalStateNotices();
    expect((await applyOnce(projectPath, "Bash")).localStateWarning).toBeUndefined();
  });

  it("never edits or creates the project's .gitignore", async () => {
    const projectPath = await makeTempProject();
    const gitignorePath = path.join(projectPath, ".gitignore");
    await fs.writeFile(gitignorePath, "node_modules/\n", "utf8");

    await applyOnce(projectPath, "Write");

    expect(await fs.readFile(gitignorePath, "utf8")).toBe("node_modules/\n");
    await expect(
      fs.stat(path.join(projectPath, ".git", "info", "exclude")),
    ).rejects.toThrow();
  });

  it("stays silent when .gitignore already covers the directory", async () => {
    const projectPath = await makeTempProject();
    await fs.writeFile(path.join(projectPath, ".gitignore"), ".agent-manager/\n", "utf8");

    const result = await applyOnce(projectPath, "Write");

    expect(result.localStateWarning).toBeUndefined();
  });

  it("stays silent when .git/info/exclude already covers the directory", async () => {
    const projectPath = await makeTempProject();
    await fs.writeFile(
      path.join(projectPath, ".git", "info", "exclude"),
      ".agent-manager/\n",
      "utf8",
    );

    const result = await applyOnce(projectPath, "Write");

    expect(result.localStateWarning).toBeUndefined();
  });

  it("carries no file contents in the warning message", async () => {
    const projectPath = await makeTempProject();
    const agentPath = path.join(projectPath, ".claude", "agents", "backend.md");
    const secret = "sk-test-do-not-leak-0123456789";
    await fs.appendFile(agentPath, `\nToken: ${secret}\n`, "utf8");

    const result = await applyOnce(projectPath, "Write");

    const message = result.localStateWarning!.message;
    expect(message).not.toContain(secret);
    expect(message).not.toContain("You are a backend developer");
    expect(message).not.toContain("backend.md");
  });
});

describe("rollbackConfiguration() local-state warning", () => {
  it("does not warn again after the apply that created the directory", async () => {
    const projectPath = await makeTempProject();
    const applyResult = await applyOnce(projectPath, "Write");
    expect(applyResult.localStateWarning).toBeDefined();

    const rollbackResult = await rollbackConfiguration({
      operationId: applyResult.operationId,
      confirmed: true,
      projectPath,
    });

    expect(rollbackResult.localStateWarning).toBeUndefined();
  });
});
