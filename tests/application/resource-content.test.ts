import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { InventoryResource } from "../../src/core/model/index.js";
import { RESOURCE_CLASS } from "../../src/core/compat/resource-class.js";
import {
  buildScannedRoots,
  readResourceContent,
  RESOURCE_CONTENT_MAX_BYTES,
  ResourceContentError,
} from "../../src/application/resource-content.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

async function makeTempDir(): Promise<string> {
  const dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "capsight-resource-content-")));
  tempDirs.push(dir);
  return dir;
}

function agentResource(filePath: string): InventoryResource {
  return {
    id: "claude:agent:backend",
    kind: "agent",
    platform: "claude",
    scope: "project",
    resourceClass: RESOURCE_CLASS.AGENT_MARKDOWN,
    path: filePath,
    name: "backend",
  };
}

describe("readResourceContent", () => {
  it("returns separated frontmatter and body", async () => {
    const root = await makeTempDir();
    const filePath = path.join(root, "agent.md");
    await fs.writeFile(
      filePath,
      `---
name: backend
description: Demo
---
# Hello
`,
    );

    const roots = await buildScannedRoots(root, []);
    const result = await readResourceContent(agentResource(filePath), roots);

    expect(result.frontmatter).toEqual({
      name: "backend",
      description: "Demo",
    });
    expect(result.body).toBe("# Hello\n");
    expect(result.truncated).toBe(false);
  });

  it("truncates files above the cap without error", async () => {
    const root = await makeTempDir();
    const filePath = path.join(root, "large.md");
    const body = "x".repeat(RESOURCE_CONTENT_MAX_BYTES + 128);
    await fs.writeFile(filePath, `---\nname: big\n---\n${body}`);

    const roots = await buildScannedRoots(root, []);
    const result = await readResourceContent(agentResource(filePath), roots);

    expect(result.truncated).toBe(true);
    expect(result.body.length).toBeLessThanOrEqual(RESOURCE_CONTENT_MAX_BYTES);
  });

  it.skipIf(process.platform === "win32")(
    "refuses a symlink that resolves outside scanned roots",
    async () => {
      const root = await makeTempDir();
      const outside = await makeTempDir();
      const outsideFile = path.join(outside, "secret.md");
      await fs.writeFile(outsideFile, "# Outside\n");

      const linkPath = path.join(root, "escape.md");
      await fs.symlink(outsideFile, linkPath);

      const roots = await buildScannedRoots(root, []);
      await expect(readResourceContent(agentResource(linkPath), roots)).rejects.toMatchObject({
        code: "refused",
      } satisfies Partial<ResourceContentError>);
    },
  );

  it("refuses paths that resolve outside scanned roots", async () => {
    const root = await makeTempDir();
    const outside = await makeTempDir();
    const outsideFile = path.join(outside, "secret.md");
    await fs.writeFile(outsideFile, "# Outside\n");

    const roots = await buildScannedRoots(root, []);
    await expect(readResourceContent(agentResource(outsideFile), roots)).rejects.toMatchObject({
      code: "refused",
    } satisfies Partial<ResourceContentError>);
  });

  it("throws not-found when the resource path is absent", async () => {
    const root = await makeTempDir();
    const roots = await buildScannedRoots(root, []);

    await expect(
      readResourceContent(agentResource(path.join(root, "missing.md")), roots),
    ).rejects.toMatchObject({
      code: "not-found",
    } satisfies Partial<ResourceContentError>);
  });
});
