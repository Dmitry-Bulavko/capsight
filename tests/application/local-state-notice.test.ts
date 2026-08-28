import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  checkLocalStateNotice,
  markLocalStateNoticeDelivered,
  resetLocalStateNotices,
} from "../../src/application/local-state-notice.js";

const tempDirs: string[] = [];

beforeEach(() => {
  resetLocalStateNotices();
});

afterEach(async () => {
  resetLocalStateNotices();
  await Promise.all(
    tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

/** A throwaway directory that is not a git repository. */
async function makeTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "capsight-local-state-"));
  tempDirs.push(dir);
  // Resolve symlinked temp roots so path comparisons in the assertions hold.
  return fs.realpath(dir);
}

/** A throwaway git repository (no git binary involved: only the layout matters). */
async function makeTempRepo(): Promise<string> {
  const dir = await makeTempDir();
  await fs.mkdir(path.join(dir, ".git", "info"), { recursive: true });
  return dir;
}

async function listEntries(dir: string): Promise<string[]> {
  return (await fs.readdir(dir)).sort();
}

describe("checkLocalStateNotice()", () => {
  it("warns on the first write into a repository that does not ignore the directory", async () => {
    const projectPath = await makeTempRepo();

    const warning = await checkLocalStateNotice(projectPath);

    expect(warning).not.toBeNull();
    expect(warning!.code).toBe("local-state-not-ignored");
    expect(warning!.directory).toBe(path.join(projectPath, ".agent-manager"));
    expect(warning!.message).toContain(path.join(projectPath, ".agent-manager"));
  });

  it("is read-only: the check itself creates nothing in the project", async () => {
    const projectPath = await makeTempRepo();
    const before = await listEntries(projectPath);

    await checkLocalStateNotice(projectPath);

    expect(await listEntries(projectPath)).toEqual(before);
    await expect(fs.stat(path.join(projectPath, ".agent-manager"))).rejects.toThrow();
    await expect(fs.stat(path.join(projectPath, ".gitignore"))).rejects.toThrow();
  });

  it("stays silent once the warning was delivered for this project", async () => {
    const projectPath = await makeTempRepo();
    expect(await checkLocalStateNotice(projectPath)).not.toBeNull();

    markLocalStateNoticeDelivered(projectPath);

    expect(await checkLocalStateNotice(projectPath)).toBeNull();
  });

  it("stays silent once the local state directory exists", async () => {
    const projectPath = await makeTempRepo();
    await fs.mkdir(path.join(projectPath, ".agent-manager"), { recursive: true });

    expect(await checkLocalStateNotice(projectPath)).toBeNull();
  });

  it("stays silent when the project's own .gitignore covers the directory", async () => {
    const projectPath = await makeTempRepo();
    await fs.writeFile(
      path.join(projectPath, ".gitignore"),
      "node_modules/\n.agent-manager/\n",
      "utf8",
    );

    expect(await checkLocalStateNotice(projectPath)).toBeNull();
  });

  it("stays silent when a parent .gitignore covers the directory", async () => {
    const repoPath = await makeTempRepo();
    await fs.writeFile(path.join(repoPath, ".gitignore"), ".agent-manager/\n", "utf8");
    const projectPath = path.join(repoPath, "packages", "app");
    await fs.mkdir(projectPath, { recursive: true });

    expect(await checkLocalStateNotice(projectPath)).toBeNull();
  });

  it("stays silent when .git/info/exclude covers the directory", async () => {
    const projectPath = await makeTempRepo();
    await fs.writeFile(
      path.join(projectPath, ".git", "info", "exclude"),
      "# repo-local excludes\n.agent-manager/\n",
      "utf8",
    );

    expect(await checkLocalStateNotice(projectPath)).toBeNull();
  });

  it("stays silent outside a git repository: there is nothing to ignore", async () => {
    const projectPath = await makeTempDir();

    expect(await checkLocalStateNotice(projectPath)).toBeNull();
  });

  it("warns again when a nearer .gitignore negates a parent's broader ignore", async () => {
    const repoPath = await makeTempRepo();
    await fs.writeFile(path.join(repoPath, ".gitignore"), "*-manager/\n", "utf8");
    const projectPath = path.join(repoPath, "packages", "app");
    await fs.mkdir(projectPath, { recursive: true });
    await fs.writeFile(path.join(projectPath, ".gitignore"), "!.agent-manager\n", "utf8");

    expect(await checkLocalStateNotice(projectPath)).not.toBeNull();
  });

  it("tracks projects independently", async () => {
    const first = await makeTempRepo();
    const second = await makeTempRepo();

    expect(await checkLocalStateNotice(first)).not.toBeNull();
    markLocalStateNoticeDelivered(first);

    expect(await checkLocalStateNotice(first)).toBeNull();
    expect(await checkLocalStateNotice(second)).not.toBeNull();
  });
});
