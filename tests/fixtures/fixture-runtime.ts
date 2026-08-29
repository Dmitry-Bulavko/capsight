import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { SourceInfo } from "../../src/core/model/index.js";

/**
 * Fixture runs must depend on the fixture, not on the machine (§11.2, §13
 * invariant 2). `buildPlatformEnvironment` reads the `env` block of
 * `~/.claude/settings.json` and `readTrustState` reads `~/.claude.json`, so on
 * a developer box carrying either file a golden would record that developer's
 * configuration. Golden runs therefore point `$HOME` at an empty directory.
 *
 * Production behaviour is untouched: the product still reads the real
 * `~/.claude/` when scanning a real project (S1) — only the fixture runners
 * relocate the home they read.
 */
let isolatedHome: string | undefined;

export function fixtureHomeDir(): string {
  if (isolatedHome === undefined) {
    isolatedHome = fs.mkdtempSync(path.join(os.tmpdir(), "capsight-fixture-home-"));
  }
  return isolatedHome;
}

export function cleanupFixtureHome(): void {
  if (isolatedHome !== undefined) {
    fs.rmSync(isolatedHome, { recursive: true, force: true });
    isolatedHome = undefined;
  }
}

/**
 * Restore `process.env` in place. Reassigning `process.env` replaces Node's
 * live environment binding with a plain object, after which `os.homedir()` —
 * which reads the real environment — stops seeing `$HOME` changes and the home
 * isolation above would silently stop working.
 */
export function restoreProcessEnv(snapshot: NodeJS.ProcessEnv): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in snapshot)) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(snapshot)) {
    if (value !== undefined && process.env[key] !== value) {
      process.env[key] = value;
    }
  }
}

export interface FixtureAgentSelector {
  agentName: string;
  /**
   * Project-relative posix path of the agent file, required when the fixture
   * declares more than one agent under the same name (an A4 collision). A4 has
   * no documented rule for which file loads, so picking "the first entry" would
   * make the golden depend on directory read order.
   */
  agentSourcePath?: string;
}

export interface FixtureAgentLike {
  name: string;
  source: SourceInfo;
}

function toPosixRelative(projectRoot: string, value: string): string {
  const relative = path.relative(path.resolve(projectRoot), path.resolve(value));
  return relative.split(path.sep).join("/");
}

/**
 * Resolve the fixture's subject agent unambiguously. A name that matches
 * several snapshot entries is an error unless `contexts.json` disambiguates it
 * with `agentSourcePath`, so a differently-ordered directory walk can never
 * silently change which candidate a golden describes.
 */
export function selectFixtureAgent<T extends FixtureAgentLike>(
  agents: readonly T[],
  selector: FixtureAgentSelector,
  projectRoot: string,
): T {
  const byName = agents.filter((entry) => entry.name === selector.agentName);
  if (byName.length === 0) {
    throw new Error(`agent ${selector.agentName} should exist`);
  }

  if (selector.agentSourcePath === undefined) {
    if (byName.length > 1) {
      const paths = byName
        .map((entry) =>
          entry.source.path === undefined
            ? "<no path>"
            : toPosixRelative(projectRoot, entry.source.path),
        )
        .sort();
      throw new Error(
        `agent ${selector.agentName} is declared by ${byName.length} entries ` +
          `(${paths.join(", ")}); contexts.json must set "agentSourcePath" to ` +
          `name the subject, otherwise the golden depends on read order`,
      );
    }
    return byName[0]!;
  }

  const matches = byName.filter(
    (entry) =>
      entry.source.path !== undefined &&
      toPosixRelative(projectRoot, entry.source.path) === selector.agentSourcePath,
  );
  if (matches.length !== 1) {
    throw new Error(
      `agent ${selector.agentName} at ${selector.agentSourcePath} should match ` +
        `exactly one entry, matched ${matches.length}`,
    );
  }
  return matches[0]!;
}
