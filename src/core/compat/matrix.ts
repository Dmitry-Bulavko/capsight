/**
 * Cross-platform compatibility lookup.
 * Version comparison for compat gating lives here; adapters supply matrix entries.
 * @see docs/COMPAT-FACTS.md, docs/SPEC.md §6, §8.1–§8.2, §2.4
 */

import type { Enforcement } from "../model/index.js";
import { compareSemver } from "../version/semver.js";
import type { ResourceClass } from "./resource-class.js";

export type CompatSupport = "supported" | "not-supported" | "unknown";

export interface CompatMatrixEntry {
  /** Stable id referenced by `matrixRef` on a founded verdict. */
  id: string;
  resourceClass: ResourceClass;
  /** Platform whose consumption of the class is stated. */
  platform: string;
  support: "supported" | "not-supported";
  factRefs: readonly string[];
  minVersion?: string;
  confidence: "doc" | "fixture" | "runtime-observed";
  enforcement: Enforcement;
  /** §2.4 wording — states what the platform reads, not what will work. */
  reason: string;
}

export interface CompatVerdict {
  support: CompatSupport;
  enforcement: Enforcement;
  matrixRef?: string;
  reason?: string;
}

export interface LookupCompatInput {
  resourceClass: ResourceClass;
  platform: string;
  /** Detected platform version, or `"unknown"` in degraded mode (§8.3). */
  version: string;
  entries: readonly CompatMatrixEntry[];
}

function unknownVerdict(message: string): CompatVerdict {
  return {
    support: "unknown",
    enforcement: "unknown",
    reason: message,
  };
}

function versionGateFails(entry: CompatMatrixEntry, version: string): boolean {
  if (version === "unknown") {
    return true;
  }
  if (!entry.minVersion) {
    return false;
  }
  const comparison = compareSemver(version, entry.minVersion);
  return comparison === null || comparison < 0;
}

/**
 * Whether a platform consumes a resource class on the detected version.
 * Missing entries and failed version gates degrade to `unknown` — never
 * `not-supported` without a founded matrix entry (§8.2).
 */
export function lookupCompat(input: LookupCompatInput): CompatVerdict {
  const { resourceClass, platform, version, entries } = input;

  const entry = entries.find(
    (candidate) =>
      candidate.resourceClass === resourceClass && candidate.platform === platform,
  );

  if (!entry) {
    return unknownVerdict(
      `No compatibility matrix entry for ${resourceClass} on ${platform}; verdict is unknown (SPEC §8.2).`,
    );
  }

  if (versionGateFails(entry, version)) {
    const versionNote =
      version === "unknown"
        ? `${platform} version was not detected`
        : `${platform} ${version} is below the documented minimum (${entry.minVersion})`;
    return unknownVerdict(
      `${versionNote}; ${resourceClass} compatibility resolves as unknown (SPEC §8.3).`,
    );
  }

  return {
    support: entry.support,
    enforcement: entry.enforcement,
    matrixRef: entry.id,
    reason: entry.reason,
  };
}

export function mergeCompatEntries(
  ...groups: readonly (readonly CompatMatrixEntry[])[]
): readonly CompatMatrixEntry[] {
  const seen = new Map<string, CompatMatrixEntry>();
  for (const group of groups) {
    for (const entry of group) {
      const key = `${entry.resourceClass}\0${entry.platform}`;
      if (!seen.has(key)) {
        seen.set(key, entry);
      }
    }
  }
  return [...seen.values()];
}
