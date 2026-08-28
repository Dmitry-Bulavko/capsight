import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { walkProjectScopes } from "../../../../src/adapters/claude/discovery/project-walk.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(async (dir) => {
      await fs.rm(dir, { recursive: true, force: true });
    }),
  );
});

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

async function mkdirp(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

describe("walkProjectScopes", () => {
  it("collects nested .claude scopes from start path up to repo root", async () => {
    const repoRoot = await makeTempDir("capsight-walk-git-");
    await mkdirp(path.join(repoRoot, ".git"));
    await mkdirp(path.join(repoRoot, "packages", "app", ".claude", "agents"));
    await mkdirp(path.join(repoRoot, "packages", "app", ".claude", "skills"));
    await mkdirp(path.join(repoRoot, "packages", ".claude", "agents"));

    const startPath = path.join(repoRoot, "packages", "app");
    const result = await walkProjectScopes(startPath);

    expect(result.projectPath).toBe(path.resolve(startPath));
    expect(result.repoRoot).toBe(path.resolve(repoRoot));
    expect(result.scopes).toHaveLength(3);

    const [appScope, packagesScope, rootScope] = result.scopes;

    expect(appScope).toEqual({
      path: path.resolve(startPath),
      hasClaudeDir: true,
      agentsPath: path.join(path.resolve(startPath), ".claude", "agents"),
      skillsPath: path.join(path.resolve(startPath), ".claude", "skills"),
    });

    expect(packagesScope).toEqual({
      path: path.resolve(path.join(repoRoot, "packages")),
      hasClaudeDir: true,
      agentsPath: path.join(
        path.resolve(path.join(repoRoot, "packages")),
        ".claude",
        "agents",
      ),
    });

    expect(rootScope).toEqual({
      path: path.resolve(repoRoot),
      hasClaudeDir: false,
    });
  });

  it("walks to filesystem root for non-git projects", async () => {
    const outer = await makeTempDir("capsight-walk-nogit-outer-");
    const inner = path.join(outer, "nested", "project");
    await mkdirp(path.join(inner, ".claude", "agents"));

    const result = await walkProjectScopes(inner);
    const scopePaths = result.scopes.map((scope) => scope.path);

    expect(result.repoRoot).toBe(path.resolve(inner));
    expect(scopePaths.slice(0, 3)).toEqual([
      path.resolve(inner),
      path.resolve(path.join(outer, "nested")),
      path.resolve(outer),
    ]);
    expect(result.scopes[0]).toMatchObject({
      hasClaudeDir: true,
      agentsPath: path.join(path.resolve(inner), ".claude", "agents"),
    });

    const lastScope = scopePaths.at(-1)!;
    expect(path.dirname(lastScope)).toBe(lastScope);
  });

  it("returns a single scope when start path is the repo root", async () => {
    const repoRoot = await makeTempDir("capsight-walk-root-");
    await mkdirp(path.join(repoRoot, ".git"));
    await mkdirp(path.join(repoRoot, ".claude", "skills"));

    const result = await walkProjectScopes(repoRoot);

    expect(result.repoRoot).toBe(path.resolve(repoRoot));
    expect(result.scopes).toHaveLength(1);
    expect(result.scopes[0]).toEqual({
      path: path.resolve(repoRoot),
      hasClaudeDir: true,
      skillsPath: path.join(path.resolve(repoRoot), ".claude", "skills"),
    });
  });

  it("throws when start path is not a directory", async () => {
    const tempDir = await makeTempDir("capsight-walk-file-");
    const filePath = path.join(tempDir, "not-a-dir.txt");
    await fs.writeFile(filePath, "x");

    await expect(walkProjectScopes(filePath)).rejects.toThrow(
      "Project path is not a directory",
    );
  });
});
