import fs from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import type { InventoryResource, PlatformDetection } from "../core/model/index.js";
import { isMarkdownContentKind } from "../core/model/ecosystem.js";

export const RESOURCE_CONTENT_MAX_BYTES = 512 * 1024;

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

export interface ResourceContentResult {
  frontmatter: Record<string, unknown>;
  body: string;
  truncated: boolean;
}

export class ResourceContentError extends Error {
  constructor(
    message: string,
    readonly code: "not-found" | "refused" | "not-file" | "unreadable",
  ) {
    super(message);
    this.name = "ResourceContentError";
  }
}

export { isMarkdownContentKind } from "../core/model/ecosystem.js";

function isPathContained(filePath: string, roots: readonly string[]): boolean {
  const normalized = path.resolve(filePath);
  for (const root of roots) {
    const resolvedRoot = path.resolve(root);
    const relative = path.relative(resolvedRoot, normalized);
    if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
      return true;
    }
  }
  return false;
}

function splitFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
  const match = content.match(FRONTMATTER_RE);
  if (!match) {
    return { frontmatter: {}, body: content };
  }

  try {
    const parsed = parseYaml(match[1]);
    const frontmatter =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    const body = content.slice(match[0].length).trimStart();
    return { frontmatter, body };
  } catch {
    return { frontmatter: {}, body: content };
  }
}

export async function buildScannedRoots(
  projectPath: string,
  detection: PlatformDetection[],
): Promise<string[]> {
  const roots = new Set<string>();

  const addRoot = async (candidate: string): Promise<void> => {
    try {
      roots.add(await fs.realpath(path.resolve(candidate)));
    } catch {
      // ignore missing roots
    }
  };

  await addRoot(projectPath);

  for (const entry of detection) {
    for (const evidence of entry.evidence) {
      if (!evidence.path) {
        continue;
      }
      await addRoot(evidence.path);
    }
  }

  return [...roots];
}

export async function readResourceContent(
  resource: InventoryResource,
  roots: readonly string[],
): Promise<ResourceContentResult> {
  if (!resource.path) {
    throw new ResourceContentError("Resource has no readable path", "not-found");
  }

  let resolvedPath: string;
  try {
    resolvedPath = await fs.realpath(path.resolve(resource.path));
  } catch {
    throw new ResourceContentError("Resource file not found", "not-found");
  }

  if (!isPathContained(resolvedPath, roots)) {
    throw new ResourceContentError(
      "Resolved path escapes every scanned root",
      "refused",
    );
  }

  let stat;
  try {
    stat = await fs.stat(resolvedPath);
  } catch {
    throw new ResourceContentError("Resource file not found", "not-found");
  }

  if (!stat.isFile()) {
    throw new ResourceContentError("Resource path is not a regular file", "not-file");
  }

  let handle: FileHandle;
  try {
    handle = await fs.open(resolvedPath, "r");
  } catch {
    throw new ResourceContentError("Resource file is unreadable", "unreadable");
  }

  try {
    const readLength = Math.min(stat.size, RESOURCE_CONTENT_MAX_BYTES + 1);
    const buffer = Buffer.alloc(readLength);
    const { bytesRead } = await handle.read(buffer, 0, readLength, 0);
    const truncated = stat.size > RESOURCE_CONTENT_MAX_BYTES;
    const raw = buffer.subarray(0, bytesRead).toString("utf8");
    const content = truncated ? raw.slice(0, RESOURCE_CONTENT_MAX_BYTES) : raw;
    const { frontmatter, body } = splitFrontmatter(content);
    return { frontmatter, body, truncated };
  } catch {
    throw new ResourceContentError("Resource file is unreadable", "unreadable");
  } finally {
    await handle.close();
  }
}
