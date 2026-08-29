import fs from "node:fs/promises";
import path from "node:path";

/**
 * Plugin agent sources (A1, A6, A8).
 *
 * SPEC §3 establishes what a plugin's `agents/` directory *does* — lowest
 * priority on a name collision (A1), a scoped id that includes the subfolder
 * (A6), a nameless file that still loads (A8) — but it establishes nothing
 * about *where* an installed plugin lives on disk. So this module never
 * guesses an install location: plugin roots are configuration handed to the
 * scan (`scan({ pluginRoots })`), and a scan given none reports no plugin
 * agents rather than probing a convention that would only be right on the
 * machine it was written on.
 *
 * Everything below is read from the configured root itself, so a fixture and a
 * real installation go down the same path (§13 invariant 2).
 */
export interface PluginInstallation {
  /** Absolute path to the configured plugin root. */
  root: string;
  /** Plugin name used as the first segment of the A6 scoped id. */
  name: string;
  /**
   * Where `name` came from: the plugin's own manifest when it ships one,
   * otherwise the directory name of the configured root. Both are read from
   * the input; neither is an assumption about how plugins are installed.
   */
  nameSource: "manifest" | "directory";
  /** Absolute path to `<root>/agents/`, absent when the plugin ships none. */
  agentsPath?: string;
}

/** Manifest a plugin ships to name itself, read when present, never required. */
const PLUGIN_MANIFEST_PATH = [".claude-plugin", "plugin.json"];

async function isDirectory(dirPath: string): Promise<boolean> {
  try {
    return (await fs.stat(dirPath)).isDirectory();
  } catch {
    return false;
  }
}

async function readManifestName(root: string): Promise<string | undefined> {
  try {
    const raw = await fs.readFile(path.join(root, ...PLUGIN_MANIFEST_PATH), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const name = (parsed as Record<string, unknown>).name;
      if (typeof name === "string" && name.trim() !== "") {
        return name.trim();
      }
    }
  } catch {
    // An unreadable or unparsable manifest is not fatal: A8 keeps a plugin's
    // agents loadable regardless, so the directory name stands in.
  }
  return undefined;
}

/**
 * Describe each configured plugin root. Roots that are not directories are
 * dropped; a root without an `agents/` directory is kept but contributes no
 * agent sources.
 */
export async function resolvePluginInstallations(
  pluginRoots: readonly string[] = [],
): Promise<PluginInstallation[]> {
  const installations: PluginInstallation[] = [];
  const seen = new Set<string>();

  for (const configured of pluginRoots) {
    const root = path.resolve(configured);
    if (seen.has(root) || !(await isDirectory(root))) {
      continue;
    }
    seen.add(root);

    const manifestName = await readManifestName(root);
    const agentsPath = path.join(root, "agents");

    installations.push({
      root,
      name: manifestName ?? path.basename(root),
      nameSource: manifestName ? "manifest" : "directory",
      ...((await isDirectory(agentsPath)) ? { agentsPath } : {}),
    });
  }

  return installations;
}

/**
 * A6 scoped id: `<plugin>:<subfolder segments>:<agent>`, e.g.
 * `agents/review/security.md` in plugin `my-plugin` becomes
 * `my-plugin:review:security`.
 *
 * The last segment is the agent's effective name, which for a file without
 * usable frontmatter is its file name (A8) — exactly the case A6 illustrates.
 */
export function pluginScopedId(
  pluginName: string,
  agentsRoot: string,
  filePath: string,
  agentName: string,
): string {
  const relativeDir = path.relative(
    path.resolve(agentsRoot),
    path.dirname(path.resolve(filePath)),
  );
  const segments = relativeDir
    .split(path.sep)
    .filter((segment) => segment !== "" && segment !== ".");

  return [pluginName, ...segments, agentName].join(":");
}
