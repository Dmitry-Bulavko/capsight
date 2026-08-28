/**
 * Version matrix and verified platform facts.
 * @see docs/SPEC.md §3, §8
 */

import type {
  Enforcement,
  ResolutionReason,
  ResolvedCapability,
  Warning,
} from "../../../core/model/index.js";
import { FACT, factConfidence, type FactId } from "./facts.js";

export interface FeatureCompatibility {
  id: string;
  feature: string;
  factRefs: readonly FactId[];
  minVersion?: string;
  changedIn?: readonly string[];
  observedIn?: readonly string[];
  status: "supported" | "unsupported" | "changed" | "unknown";
  confidence: "doc" | "fixture" | "runtime-observed";
  /**
   * Corpus directory under `tests/fixtures/claude/` whose `expected.json`
   * already exercises this entry. Only set when that evidence exists — an
   * entry never claims a fixture that is not written yet (SPEC §0.1.3).
   */
  fixture?: string;
  /**
   * Corpus directory that still has to cover this entry (H1-09..H1-11).
   * Mutually exclusive with `fixture`; the directory may exist while its
   * `expected.json` (or the case for this rule) is still missing.
   */
  pendingFixture?: string;
  notes?: string;
}

const MATRIX_ENTRIES = [
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
    factRefs: [FACT.N2, FACT.N5],
    minVersion: "2.1.0",
    changedIn: ["2.1.172", "2.1.217", "2.1.219"],
    status: "supported",
    confidence: "fixture",
    fixture: "depth-limit",
    notes:
      "N5 depth values: 2.1.172-2.1.216 = 5 (not configurable), 2.1.217-2.1.218 = 1, 2.1.219+ = 3. " +
      "The fixture covers N2 (removal at the limit, fork exempt) and the 2.1.219+ default of 3 " +
      "including the CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH override (N3); the pre-2.1.219 values " +
      "of N5 rest on documentation alone until a runtime probe can observe them.",
  },
  {
    id: "agent.depthLimitDefault",
    feature: "Default subagent spawn depth before 2.1.219",
    factRefs: [FACT.N5],
    changedIn: ["2.1.172", "2.1.217", "2.1.219"],
    observedIn: ["2.1.217"],
    status: "changed",
    confidence: "fixture",
    fixture: "version-drift",
    notes:
      "N5 records three different defaults below 2.1.219 (5, then 1) and no fixture or probe " +
      "has observed any of them; the resolver only knows the 2.1.219+ default of 3. The " +
      "version-drift fixture pins 2.1.217 and reproduces the discrepancy, so the depth-limit " +
      "verdict is downgraded to unknown on those versions per §8.4 rather than guessed.",
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
  {
    id: "agent.collisionSameDir",
    feature: "Name collision inside one agent directory loads a single file",
    factRefs: [FACT.A4],
    minVersion: "2.1.0",
    status: "unknown",
    confidence: "fixture",
    fixture: "collision-same-dir",
    notes:
      "Only the single-load behaviour is documented; which file wins follows FS read order (A4), so the winner stays unknown.",
  },
  {
    id: "agent.collisionNested",
    feature: "Nested project agent directories: closest to cwd wins",
    factRefs: [FACT.A3],
    minVersion: "2.1.178",
    status: "supported",
    confidence: "fixture",
    fixture: "collision-nested",
  },
  {
    id: "agent.descriptionBudget",
    feature: "Startup warning above the 15 000-token agent description budget",
    factRefs: [FACT.A10],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    pendingFixture: "invalid-agents",
    notes:
      "The invalid-agents fixture covers the A7 skip reasons only; the A10 budget warning still needs its own oversized-description case.",
  },
  {
    id: "agent.modelAllowlist",
    feature: "Agent model checked against organisation availableModels allowlist",
    factRefs: [FACT.F8],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "fixture",
    fixture: "managed-simulation",
    notes:
      "The managed-simulation fixture records the block and the substitution the simulation " +
      "reports (first entry of availableModels). Which model the platform actually substitutes " +
      "is not documented, so only the fact of the block is a platform claim.",
  },
  {
    id: "agent.pluginFieldLimits",
    feature: "Plugin agents ignore hooks, mcpServers and permissionMode",
    factRefs: [FACT.F9],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    pendingFixture: "plugin-agents",
  },
  {
    id: "skills.preload",
    feature: "Frontmatter skills list preloads skill content",
    factRefs: [FACT.K1],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    fixture: "skills-preload",
  },
  {
    id: "skills.disableModelInvocation",
    feature: "Skill with disable-model-invocation cannot be preloaded",
    factRefs: [FACT.K4],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    pendingFixture: "skills-preload",
  },
  {
    id: "skills.missing",
    feature: "Missing or disabled skill in frontmatter skills list is skipped",
    factRefs: [FACT.K5],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    pendingFixture: "skills-preload",
  },
  {
    id: "trust.inlineMcp",
    feature: "Inline MCP servers in project agents require accepted folder trust",
    factRefs: [FACT.R1, FACT.R4],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    fixture: "trust-inline-mcp",
  },
  {
    id: "trust.frontmatterHooks",
    feature: "Project agent frontmatter hooks require accepted folder trust",
    factRefs: [FACT.R5],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    pendingFixture: "trust-inline-mcp",
    notes: "The existing trust-inline-mcp fixture covers R1/R4 only; it still needs a hooks agent.",
  },
  {
    id: "instructions.hierarchy",
    feature: "Subagent receives the CLAUDE.md hierarchy of the main session",
    factRefs: [FACT.I1],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "fixture",
    fixture: "instructions",
  },
  {
    id: "instructions.builtinKind",
    feature: "Explore and Plan resolve zero instruction sources",
    factRefs: [FACT.I2],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "fixture",
    fixture: "instructions",
  },
  {
    id: "discovery.addDirAgents",
    feature: "--add-dir attaches the added directory's .claude/agents/",
    factRefs: [FACT.A9],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "fixture",
    fixture: "add-dir",
    notes:
      "A9 attaches agents only; the rest of the added directory's configuration " +
      "is not loaded. Discovery-level, so the gate lands on the discovered " +
      "agent's status rather than on a capability.",
  },
  {
    id: "discovery.addDirSkills",
    feature: "--add-dir attaches the added directory's .claude/skills/",
    factRefs: [FACT.K12],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "fixture",
    fixture: "add-dir",
    notes:
      "K12 is the deliberate exception to A9 and is [ext], so the add-dir " +
      "fixture is what lifts it above documentation (§8.2).",
  },
  {
    id: "builtin.readOnly",
    feature: "Explore and Plan built-in agents deny Write and Edit",
    factRefs: [FACT.B2],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    pendingFixture: "tools-filters",
    notes: "tools-filters has no explore/plan context yet; the built-in kinds must be added there.",
  },
] as const satisfies readonly FeatureCompatibility[];

export const VERSION_MATRIX: readonly FeatureCompatibility[] = MATRIX_ENTRIES;

/** Id of a registered matrix entry. Unregistered ids fail typecheck. */
export type MatrixId = (typeof MATRIX_ENTRIES)[number]["id"];

/**
 * Matrix id constants, e.g. `MATRIX["agent.tools"]`. Resolver call sites go
 * through this object so every reference is checked against the matrix; an
 * id that is not registered cannot be spelled at all.
 */
export const MATRIX = Object.freeze(
  Object.fromEntries(MATRIX_ENTRIES.map((entry) => [entry.id, entry.id])),
) as { readonly [K in MatrixId]: K };

export function isMatrixId(value: string): value is MatrixId {
  return VERSION_MATRIX.some((entry) => entry.id === value);
}

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

/** First version whose N5 default subagent depth (3) the corpus covers. */
const DEPTH_LIMIT_OBSERVED_FROM = "2.1.219";

/**
 * Matrix entry backing a depth-limit verdict on a given CLI version. Below
 * 2.1.219 the N5 default changed twice and no fixture or probe has observed
 * those values, so the verdict routes through the `agent.depthLimitDefault`
 * drift entry and degrades to `unknown` (§8.4). Version comparison stays in
 * this module (§8.2, §13 invariant 11).
 */
export function depthLimitMatrixId(version: string): MatrixId {
  const comparison = compareSemver(version, DEPTH_LIMIT_OBSERVED_FROM);
  return comparison === null || comparison < 0
    ? MATRIX["agent.depthLimitDefault"]
    : MATRIX["agent.depthLimit"];
}

export type { Enforcement } from "../../../core/model/index.js";

export interface EnforcementDecision {
  enforcement: Enforcement;
  /** Present only when the matrix downgraded the verdict to `unknown`. */
  reason?: ResolutionReason;
  /**
   * Set when the matrix entry backing the rule did not resolve `supported` on
   * this version — it is missing (§8.2), the version was not detected (§8.3),
   * or the entry resolved `unsupported` / `changed` / `unknown`. The rule's
   * `status` is then a version-sensitive conclusion with no basis behind it,
   * so it degrades to `unknown` alongside `enforcement` (§8.3).
   *
   * Absent when only the *evidence* behind a supported entry is too weak: the
   * platform behaviour is known, only the guarantee is not, which is exactly
   * what the `enforcement` axis is for (§6).
   */
  statusUnfounded?: true;
}

export interface ResolveEnforcementInput {
  /** Matrix entry backing the rule that produced the capability. */
  matrixId: string;
  /** Detected Claude Code version, or `"unknown"` in degraded mode (§8.3). */
  version: string;
  /** Enforcement the rule would claim if the matrix allows it. */
  baseline?: Enforcement;
}

const CONFIDENCE_RANK: Record<FeatureCompatibility["confidence"], number> = {
  doc: 0,
  fixture: 1,
  "runtime-observed": 2,
};

/**
 * Evidence actually backing an entry. A `pendingFixture` entry has no fixture
 * yet, so it can never rise above `doc` however it is annotated (§0.1.3).
 */
function evidenceConfidence(
  entry: FeatureCompatibility,
): FeatureCompatibility["confidence"] {
  return entry.fixture ? entry.confidence : "doc";
}

/**
 * The single place where a resolver rule turns into an `enforcement` verdict.
 * Version comparison never happens outside this module (§13 invariant 11).
 *
 * `unknown` is returned when: the rule has no matrix entry (§8.2), the CLI
 * version was not detected (§8.3), the entry is not `supported` on that
 * version, or the entry rests on a non-`[doc]` fact without fixture-level
 * evidence (§8.2).
 *
 * @see docs/SPEC.md §8.2, §8.3, §13 invariant 11
 */
export function resolveEnforcement(
  input: ResolveEnforcementInput,
): EnforcementDecision {
  const { matrixId, version } = input;
  const baseline = input.baseline ?? "enforced";

  const unknown = (
    message: string,
    statusUnfounded?: true,
  ): EnforcementDecision => ({
    enforcement: "unknown",
    reason: { type: "version", message, matrixRef: matrixId },
    ...(statusUnfounded ? { statusUnfounded } : {}),
  });

  const entry = VERSION_MATRIX.find((feature) => feature.id === matrixId);
  if (!entry) {
    return unknown(
      `No version matrix entry for "${matrixId}"; the feature resolves as unknown (SPEC §8.2).`,
      true,
    );
  }

  if (version === "unknown") {
    return unknown(
      `Claude CLI version was not detected; version-sensitive feature "${matrixId}" resolves as unknown (SPEC §8.3).`,
      true,
    );
  }

  const resolved = lookupFeature(matrixId, version)!;
  if (resolved.status !== "supported") {
    return unknown(
      `Version matrix reports "${matrixId}" as ${resolved.status} on Claude Code ${version}` +
        `${entry.minVersion ? ` (requires >= ${entry.minVersion})` : ""}; the feature resolves as unknown (SPEC §8.2).`,
      true,
    );
  }

  const weakFacts = entry.factRefs.filter(
    (ref) => factConfidence(ref) !== "doc",
  );
  if (
    weakFacts.length > 0 &&
    CONFIDENCE_RANK[evidenceConfidence(entry)] < CONFIDENCE_RANK.fixture
  ) {
    return unknown(
      `Matrix entry "${matrixId}" rests on non-[doc] fact(s) ${weakFacts.join(", ")} ` +
        `but has no fixture-level evidence; enforcement is unknown (SPEC §8.2).`,
    );
  }

  return { enforcement: baseline };
}

/**
 * Apply the matrix gate to a capability produced by a resolver rule. The rule's
 * own enforcement is the baseline; the matrix can only downgrade it, and when
 * it does it appends a `version`-typed reason explaining why.
 *
 * `status` degrades to `unknown` too when the entry the rule was gated on did
 * not resolve `supported` (§8.3): what the configuration produces then depends
 * on platform behaviour we cannot pin to a version, so the status is not a
 * weaker claim but an unfounded one. A capability that is never gated — no
 * `gateCapability` call — keeps its status untouched, which is what makes the
 * distinction mechanical rather than a hand-maintained list.
 */
export function gateCapability<T extends ResolvedCapability>(
  capability: T,
  matrixId: string,
  version: string,
): T {
  const decision = resolveEnforcement({
    matrixId,
    version,
    baseline: capability.enforcement,
  });

  const status = decision.statusUnfounded ? "unknown" : capability.status;

  if (
    decision.enforcement === capability.enforcement &&
    status === capability.status &&
    !decision.reason
  ) {
    return capability;
  }

  return {
    ...capability,
    status,
    enforcement: decision.enforcement,
    reasons: decision.reason
      ? [...capability.reasons, decision.reason]
      : capability.reasons,
  };
}

/**
 * Apply the matrix gate to a `Warning` that asserts platform behaviour. The
 * warning's own enforcement is the baseline; as with `gateCapability` the
 * matrix can only downgrade it.
 *
 * When the matrix does not found the claim on this version the warning becomes
 * undetermined: `enforcement` drops to `unknown` and the reason is appended to
 * the message, since a `Warning` has no `reasons` list to carry it. Severity
 * and category are left alone — they say what the warning is about, not how
 * confident we are in it, and collapsing the two axes would lose the finding.
 *
 * @see docs/SPEC.md §6, §8.2, §8.3
 */
export function gateWarning(
  warning: Warning,
  matrixId: string,
  version: string,
): Warning {
  const decision = resolveEnforcement({
    matrixId,
    version,
    baseline: warning.enforcement ?? "enforced",
  });

  return {
    ...warning,
    matrixRef: matrixId,
    enforcement: decision.enforcement,
    ...(decision.reason
      ? { message: `${warning.message} ${decision.reason.message}` }
      : {}),
  };
}

/** Matrix entry backing a name-collision rule, when one is registered. */
const COLLISION_MATRIX_IDS: Partial<Record<FactId, MatrixId>> = {
  [FACT.A3]: "agent.collisionNested",
  [FACT.A4]: "agent.collisionSameDir",
};

export interface CollisionGate {
  /** Matrix entry the rule was gated on; absent when no entry backs the rule. */
  matrixRef?: MatrixId;
  /** Confidence in the collision record (§6); absent when it was not gated. */
  enforcement?: Enforcement;
  /**
   * `true` when the matrix does not found a winner for this rule on this
   * version — the entry is missing, unsupported, or `unknown` (A4 always is,
   * because A4 documents that one file loads but not which). The record must
   * then stay winner-free: a winner is never guessed (§8.2, §8.4).
   *
   * `false` for a rule with no registered entry: such a record was never gated
   * at all, and this function does not silently claim it was.
   */
  winnerUnfounded: boolean;
}

/**
 * Gate a name-collision record produced by discovery. Discovery-level, so the
 * verdict lands on the record rather than on a `ResolvedCapability`, but the
 * version arithmetic stays here (§13 invariant 11).
 */
export function gateCollision(rule: string, version: string): CollisionGate {
  const matrixRef = COLLISION_MATRIX_IDS[rule as FactId];
  if (!matrixRef) {
    return { winnerUnfounded: false };
  }

  const decision = resolveEnforcement({ matrixId: matrixRef, version });
  return {
    matrixRef,
    enforcement: decision.enforcement,
    winnerUnfounded: decision.statusUnfounded === true,
  };
}

export interface DiscoveryGate {
  enforcement: Enforcement;
  /**
   * `true` when the matrix does not found the discovery rule on this version:
   * the files were read, but whether the platform loads them is not a claim we
   * can make, so the finding is reported as `unknown` (§8.2, §8.3).
   */
  unfounded: boolean;
}

/**
 * Gate a discovery-level finding — "the platform loads what we found here" —
 * against the entry that documents the rule which attached it (A9, K12).
 */
export function gateDiscovery(matrixId: string, version: string): DiscoveryGate {
  const decision = resolveEnforcement({ matrixId, version });
  return {
    enforcement: decision.enforcement,
    unfounded: decision.statusUnfounded === true,
  };
}
