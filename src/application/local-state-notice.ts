import fs from "node:fs/promises";
import path from "node:path";
import {
  evaluateDirectoryIgnore,
  localStateWarning,
  parseIgnoreRules,
  LOCAL_STATE_DIR,
  type IgnoreRule,
  type LocalStateWarning,
} from "../core/warnings/local-state.js";

export type { LocalStateWarning };

/**
 * Projects already told about `.agent-manager/` in this process.
 *
 * The "first write" signal itself is the absence of `<project>/.agent-manager`
 * on disk: once the first write creates it, later runs stay silent. That needs
 * no marker file, so the tool still writes nothing into the project beyond
 * `.agent-manager/` (§13 invariant 6). This set only stops a single command
 * that writes twice (backup + history) from warning twice.
 */
const notifiedProjects = new Set<string>();

/** Test seam: forget which projects were warned in this process. */
export function resetLocalStateNotices(): void {
  notifiedProjects.clear();
}

async function exists(target: string): Promise<boolean> {
  try {
    await fs.stat(target);
    return true;
  } catch {
    return false;
  }
}

async function readIgnoreFile(filePath: string): Promise<IgnoreRule[] | null> {
  try {
    return parseIgnoreRules(await fs.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

interface IgnoreSource {
  /** Directory the rules are relative to. */
  dir: string;
  rules: IgnoreRule[];
}

/**
 * Collect the ignore rules that could cover `<projectPath>/.agent-manager`, by
 * reading ignore files directly rather than invoking git. Walks up from the
 * project to the repository root, newest-precedence last: `.git/info/exclude`
 * first, then `.gitignore` files from the repository root down to the project.
 * `core.excludesFile` is not read — missing it can only produce an extra
 * warning, never a missed one.
 *
 * Returns null when no repository was found: there is nothing to ignore.
 */
async function collectIgnoreSources(projectPath: string): Promise<IgnoreSource[] | null> {
  const gitignores: IgnoreSource[] = [];
  let repoExclude: IgnoreSource | null = null;
  let found = false;

  let dir = path.resolve(projectPath);
  for (;;) {
    const rules = await readIgnoreFile(path.join(dir, ".gitignore"));
    if (rules) {
      gitignores.unshift({ dir, rules });
    }

    if (await exists(path.join(dir, ".git"))) {
      found = true;
      const excludeRules = await readIgnoreFile(path.join(dir, ".git", "info", "exclude"));
      if (excludeRules) {
        repoExclude = { dir, rules: excludeRules };
      }
      break;
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  if (!found) {
    return null;
  }
  return repoExclude ? [repoExclude, ...gitignores] : gitignores;
}

async function isLocalStateIgnored(projectPath: string): Promise<boolean> {
  const sources = await collectIgnoreSources(projectPath);
  if (!sources) {
    // Not a git repository: nothing to gitignore, so nothing to warn about.
    return true;
  }

  const target = path.join(path.resolve(projectPath), LOCAL_STATE_DIR);
  // `sources` is ordered least- to most-specific, so a nearer ignore file (or a
  // negation in it) overrides a farther one, as git resolves the same conflict.
  let ignored = false;
  for (const source of sources) {
    const relative = path.relative(source.dir, target);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      continue;
    }
    const decision = evaluateDirectoryIgnore(
      source.rules,
      relative.split(path.sep).join("/"),
    );
    if (decision !== null) {
      ignored = decision;
    }
  }
  return ignored;
}

/**
 * Decide whether the caller's write into `<projectPath>/.agent-manager` is the
 * first one and should be announced. Read-only: call before the write, then
 * `markLocalStateNoticeDelivered` only if the write actually happened.
 */
export async function checkLocalStateNotice(
  projectPath: string,
): Promise<LocalStateWarning | null> {
  const resolved = path.resolve(projectPath);
  if (notifiedProjects.has(resolved)) {
    return null;
  }

  const directory = path.join(resolved, LOCAL_STATE_DIR);
  if (await exists(directory)) {
    return null;
  }
  if (await isLocalStateIgnored(resolved)) {
    return null;
  }

  return localStateWarning(directory);
}

/** Record that the warning was surfaced for this project in this process. */
export function markLocalStateNoticeDelivered(projectPath: string): void {
  notifiedProjects.add(path.resolve(projectPath));
}
