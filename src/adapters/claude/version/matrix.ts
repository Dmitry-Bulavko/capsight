/**
 * Version matrix and verified platform facts.
 * @see docs/SPEC.md §3, §8
 */

import { FACT, type FactId } from "./facts.js";

export interface FeatureCompatibility {
  id: string;
  feature: string;
  factRefs: readonly FactId[];
  minVersion?: string;
  changedIn?: string[];
  observedIn?: string[];
  status: "supported" | "unsupported" | "changed" | "unknown";
  confidence: "doc" | "fixture" | "runtime-observed";
  fixture?: string;
  notes?: string;
}

export const VERSION_MATRIX: FeatureCompatibility[] = [
  {
    id: "agent.disallowedTools",
    feature: "Agent frontmatter disallowedTools filtering",
    factRefs: [FACT.F2, FACT.F3],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    fixture: "tools-filters",
    notes: "disallowedTools applied before tools whitelist; MCP patterns per F3.",
  },
  {
    id: "agent.tools",
    feature: "Agent frontmatter tools whitelist",
    factRefs: [FACT.F2, FACT.F4],
    minVersion: "2.1.0",
    changedIn: ["2.1.208"],
    status: "supported",
    confidence: "doc",
    fixture: "tools-filters",
    notes: "Empty resolved tools list blocks subagent launch from v2.1.208 (F4).",
  },
  {
    id: "agent.toolAliases",
    feature: "Agent and Task tool name aliases",
    factRefs: [FACT.F11],
    minVersion: "2.1.63",
    status: "supported",
    confidence: "doc",
    fixture: "tools-filters",
  },
  {
    id: "context.filter1",
    feature: "Subagent filter 1",
    factRefs: [FACT.T1],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    fixture: "tools-filters",
  },
  {
    id: "context.filter2",
    feature: "Background subagent filter 2",
    factRefs: [FACT.T2],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    fixture: "background",
  },
  {
    id: "context.fork",
    feature: "Fork context skips agent configuration filters",
    factRefs: [FACT.T3],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    fixture: "fork",
  },
  {
    id: "agent.depthLimit",
    feature: "Agent tool unavailable at subagent depth limit",
    factRefs: [FACT.N2],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    fixture: "depth-limit",
  },
  {
    id: FACT.P1,
    feature: "Parent bypassPermissions/acceptEdits overrides agent permissionMode",
    factRefs: [FACT.P1],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    fixture: "permission-inheritance",
  },
  {
    id: FACT.P2,
    feature: "Parent auto mode ignores agent permissionMode frontmatter",
    factRefs: [FACT.P2],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    fixture: "permission-inheritance",
  },
  {
    id: FACT.P4,
    feature: "permissions.disableBypassPermissionsMode blocks agent bypassPermissions",
    factRefs: [FACT.P4],
    minVersion: "2.1.223",
    status: "supported",
    confidence: "doc",
    fixture: "permission-inheritance",
  },
  {
    id: FACT.P5,
    feature: "Agent permissionMode from frontmatter when no parent override",
    factRefs: [FACT.P5],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    fixture: "permission-inheritance",
  },
];

function parseSemver(version: string): [number, number, number] | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    return null;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** @returns negative if a < b, positive if a > b, 0 if equal, null if unparsable */
export function compareSemver(a: string, b: string): number | null {
  const left = parseSemver(a);
  const right = parseSemver(b);
  if (!left || !right) {
    return null;
  }

  for (let i = 0; i < 3; i++) {
    if (left[i]! < right[i]!) {
      return -1;
    }
    if (left[i]! > right[i]!) {
      return 1;
    }
  }
  return 0;
}

/**
 * Resolve a matrix feature for a detected Claude Code version.
 * Unknown CLI version or missing matrix entry yields `status: "unknown"`.
 */
export function lookupFeature(
  id: string,
  version: string,
): FeatureCompatibility | undefined {
  const entry = VERSION_MATRIX.find((feature) => feature.id === id);
  if (!entry) {
    return undefined;
  }

  if (version === "unknown") {
    return { ...entry, status: "unknown" };
  }

  if (entry.minVersion) {
    const comparison = compareSemver(version, entry.minVersion);
    if (comparison === null || comparison < 0) {
      return { ...entry, status: "unsupported" };
    }
  }

  return entry;
}
