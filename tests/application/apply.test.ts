import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  APPLY_SUCCESS_MESSAGE,
  applyConfiguration,
  getHistory,
  rollbackConfiguration,
  ApplyNotConfirmedError,
  SnapshotChangedError,
} from "../../src/application/apply.js";
import { scan } from "../../src/application/scan.js";
import { clearLastScan, setLastScan } from "../../src/application/scan-store.js";
import { readBackupManifest } from "../../src/adapters/claude/generation/apply.js";

const tempDirs: string[] = [];

afterEach(async () => {
  clearLastScan();
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

async function makeTempProject(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "capsight-apply-"));
  tempDirs.push(dir);
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

describe("applyConfiguration()", () => {
  it("creates backup, applies planned fields, and returns confirmation message", async () => {
    const projectPath = await makeTempProject();
    const scanResult = await scan({ projectPath });
    setLastScan(scanResult);

    const agent = scanResult.snapshot.agents.find((entry) => entry.name === "backend");
    expect(agent?.source.path).toBeDefined();

    const originalContent = await fs.readFile(agent!.source.path!, "utf8");

    const result = await applyConfiguration({
      pending: { byAgent: { [agent!.id]: { Write: true } } },
      editSnapshotId: scanResult.snapshot.id,
      confirmed: true,
      projectPath,
    });

    expect(result.message).toBe(APPLY_SUCCESS_MESSAGE);
    expect(result.files).toHaveLength(1);
    expect(result.files[0].changes).toEqual([
      {
        field: "tools",
        before: ["Grep", "Read"],
        after: ["Grep", "Read", "Write"],
      },
    ]);

    const updatedContent = await fs.readFile(agent!.source.path!, "utf8");
    expect(updatedContent).toContain("Write");
    expect(updatedContent).toContain("name: backend");

    const manifest = await readBackupManifest(projectPath, result.operationId);
    expect(manifest.snapshotId).toBe(scanResult.snapshot.id);
    expect(manifest.claudeVersion.version).toBeTruthy();
    expect(manifest.files).toHaveLength(1);

    const backupContent = await fs.readFile(
      path.join(
        projectPath,
        ".agent-manager",
        "backups",
        result.operationId,
        "files",
        ".claude",
        "agents",
        "backend.md",
      ),
      "utf8",
    );
    expect(backupContent).toBe(originalContent);
  });

  it("requires confirmation before applying", async () => {
    const projectPath = await makeTempProject();
    const scanResult = await scan({ projectPath });
    const agent = scanResult.snapshot.agents.find((entry) => entry.name === "backend");

    await expect(
      applyConfiguration({
        pending: { byAgent: { [agent!.id]: { Write: true } } },
        editSnapshotId: scanResult.snapshot.id,
        confirmed: false,
        projectPath,
      }),
    ).rejects.toBeInstanceOf(ApplyNotConfirmedError);
  });

  it("blocks apply when snapshot id changed without acknowledgement", async () => {
    const projectPath = await makeTempProject();
    const scanResult = await scan({ projectPath });
    const agent = scanResult.snapshot.agents.find((entry) => entry.name === "backend");

    await expect(
      applyConfiguration({
        pending: { byAgent: { [agent!.id]: { Write: true } } },
        editSnapshotId: "stale-snapshot-id",
        confirmed: true,
        projectPath,
      }),
    ).rejects.toBeInstanceOf(SnapshotChangedError);
  });
});

describe("rollbackConfiguration()", () => {
  it("restores files from backup and verifies by re-reading", async () => {
    const projectPath = await makeTempProject();
    const scanResult = await scan({ projectPath });
    setLastScan(scanResult);
    const agent = scanResult.snapshot.agents.find((entry) => entry.name === "backend");
    const originalContent = await fs.readFile(agent!.source.path!, "utf8");

    const applyResult = await applyConfiguration({
      pending: { byAgent: { [agent!.id]: { Write: true } } },
      editSnapshotId: scanResult.snapshot.id,
      confirmed: true,
      projectPath,
    });

    const rollbackResult = await rollbackConfiguration({
      operationId: applyResult.operationId,
      confirmed: true,
      projectPath,
    });

    expect(rollbackResult.verified).toBe(true);
    expect(rollbackResult.restoredFiles).toEqual([agent!.source.path]);

    const restoredContent = await fs.readFile(agent!.source.path!, "utf8");
    expect(restoredContent).toBe(originalContent);
  });
});

describe("getHistory()", () => {
  it("returns apply and rollback operations", async () => {
    const projectPath = await makeTempProject();
    const scanResult = await scan({ projectPath });
    setLastScan(scanResult);
    const agent = scanResult.snapshot.agents.find((entry) => entry.name === "backend");

    const applyResult = await applyConfiguration({
      pending: { byAgent: { [agent!.id]: { Write: true } } },
      editSnapshotId: scanResult.snapshot.id,
      confirmed: true,
      projectPath,
    });

    await rollbackConfiguration({
      operationId: applyResult.operationId,
      confirmed: true,
      projectPath,
    });

    const history = await getHistory(projectPath);
    expect(history.some((entry) => entry.type === "apply")).toBe(true);
    expect(history.some((entry) => entry.type === "rollback")).toBe(true);
    expect(history.find((entry) => entry.type === "apply")?.rolledBack).toBe(true);
  });
});
