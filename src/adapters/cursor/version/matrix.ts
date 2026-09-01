/**
 * Cursor version matrix and verified platform facts.
 *
 * ## When an entry may claim `confidence: "fixture"` (H1-28)
 *
 * `confidence` describes the evidence behind *this entry's own rule*, not
 * behind the CURSOR-FACTS facts it cites. An entry may claim `"fixture"` only
 * when a corpus fixture makes every part of that rule the operative cause of a
 * *confident* golden expectation: delete the rule from the resolver and a
 * non-`unknown` value in that fixture's `expected.json` changes. A fixture
 * that merely runs while the rule is present, or that produces only `unknown`
 * for it, is not evidence — an `unknown` claims nothing (§11.3), so an entry
 * whose `status` is `unknown` by construction can never reach `"fixture"`.
 *
 * `verifiedFacts` names the subset of `factRefs` the named fixture exercises
 * *entire*, as the operative cause of a confident golden expectation. Only
 * those facts are counted as fixture evidence by §11.4.
 *
 * @see docs/CURSOR-FACTS.md, docs/SPEC.md §8, §11.4
 */

import type { CompatMatrixEntry } from "../../../core/compat/matrix.js";
import { compareSemver } from "../../../core/version/semver.js";
import { RESOURCE_CLASS } from "../../../core/compat/resource-class.js";
import type { Enforcement, Warning } from "../../../core/model/index.js";
import { FACT, type FactId } from "./facts.js";

export interface FeatureCompatibility {
  id: string;
  feature: string;
  factRefs: readonly FactId[];
  minVersion?: string;
  /** Inclusive upper bound; detected version above this resolves the entry as unsupported. */
  maxVersion?: string;
  changedIn?: readonly string[];
  observedIn?: readonly string[];
  status: "supported" | "unsupported" | "changed" | "unknown";
  confidence: "doc" | "fixture" | "runtime-observed";
  /**
   * Corpus directory under `tests/fixtures/cursor/` whose `expected.json`
   * already exercises this entry.
   */
  fixture?: string;
  /**
   * Corpus directory that still has to cover this entry. Mutually exclusive
   * with `fixture`.
   */
  pendingFixture?: string;
  /**
   * Why no fixture can ever promote this entry (H1-28). Mutually exclusive
   * with `fixture` and `pendingFixture`.
   */
  noFixturePossible?: string;
  /**
   * Subset of `factRefs` the named fixture exercises *entire*. Set (possibly
   * empty) on every entry that names a `fixture` (H1-28).
   */
  verifiedFacts?: readonly FactId[];
  notes?: string;
}

const MATRIX_ENTRIES = [
  {
    id: "agent.toolPool",
    feature: "Subagent declared tools resolve to effective pool",
    factRefs: [FACT.CA4],
    status: "unknown",
    confidence: "doc",
    noFixturePossible:
      "CA4 records that subagent tool pool semantics are unknown; the resolver " +
      "returns unknown for every declared tool and an unknown claims nothing " +
      "(§11.3), so no fixture can make this entry the operative cause of a " +
      "confident golden value (H1-28).",
    notes: "Tool pool semantics not documented for Cursor v1",
  },
  {
    id: "trust.project",
    feature: "Project folder trust gate",
    factRefs: [FACT.CT1],
    status: "unknown",
    confidence: "doc",
    noFixturePossible:
      "CT1 records that Cursor has no trust record equivalent; the resolver " +
      "emits an unknown trust warning and never blocks on trust, so every " +
      "value this entry causes is unknown by construction (§11.3).",
    notes: "No Cursor trust record equivalent documented",
  },
  {
    id: "collision.sameDir",
    feature: "Same-directory agent name collision",
    factRefs: [FACT.CA3, FACT.CW4],
    status: "supported",
    confidence: "fixture",
    fixture: "collision-same-dir",
    verifiedFacts: [FACT.CA3],
    notes:
      "CA3 entire: the collision-same-dir fixture declares two agents with the " +
      "same name under one agents root; both resolve ambiguous with collision " +
      "enforcement enforced. CW4 covers cross-scope shadowing and is not " +
      "exercised in this fixture. Deletion test (D1-07): with the collision " +
      "rule removed both agents resolve active and the ambiguous-collision " +
      "warnings leave the golden.",
  },
  {
    id: "rules.fileExtension",
    feature: "Plain .md files in .cursor/rules/ are ignored",
    factRefs: [FACT.CR4],
    maxVersion: "3.16.17",
    status: "supported",
    confidence: "fixture",
    fixture: "ignored-rules",
    verifiedFacts: [FACT.CR4],
    notes:
      "CR4 entire: ignored-rules carries plain ignored.md alongside valid.mdc; " +
      "the golden records a warning with enforcement enforced naming the ignored " +
      "file. version-drift pins 3.16.18 — above this entry's maxVersion — so the " +
      "CR4 warning downgrades to unknown per §8.4 while discovery.ruleFrontmatter " +
      "metadata on the same fixture stays present. Deletion test (D1-07): with the " +
      "rule removed the warning leaves the golden and only the .mdc rule is discovered.",
  },
  {
    id: "agent.invalid",
    feature: "Invalid agents missing name or description",
    factRefs: [FACT.CA2],
    status: "supported",
    confidence: "fixture",
    fixture: "invalid-agents",
    verifiedFacts: [FACT.CA2],
    notes:
      "CA2 entire: invalid-agents carries missing-name and missing-description " +
      "agents; the golden records both as status invalid with the specific " +
      "reasons. Deletion test (D1-07): with the validation removed those agents " +
      "resolve active in the golden.",
  },
  {
    id: "discovery.mcpProject",
    feature: "Project MCP servers load from .cursor/mcp.json",
    factRefs: [FACT.CM1],
    status: "supported",
    confidence: "fixture",
    fixture: "basic",
    verifiedFacts: [FACT.CM1],
    notes:
      "CM1 entire: basic declares github in project .cursor/mcp.json and the golden " +
      "records a configured server with that config path. Deletion test (D2-03): " +
      "skip project-scope MCP discovery and mcpServers becomes empty.",
  },
  {
    id: "mcp.envRedact",
    feature: "MCP config records env key names only",
    factRefs: [FACT.CM3],
    status: "supported",
    confidence: "fixture",
    fixture: "basic",
    verifiedFacts: [FACT.CM3],
    notes:
      "CM3 entire: basic carries GITHUB_TOKEN in mcp.json env and the golden records " +
      "envKeys without values or secrets in configHash. Deletion test (D2-03): stop " +
      "extracting env keys and envKeys leaves the golden while the hash input changes.",
  },
  {
    id: "discovery.commands",
    feature: "Slash commands discovered separately from skills",
    factRefs: [FACT.CS3],
    status: "supported",
    confidence: "fixture",
    fixture: "basic",
    verifiedFacts: [FACT.CS3],
    notes:
      "CS3 entire: basic carries both a skill and a deploy command; the golden records " +
      "kind skill and kind command as distinct entries. Deletion test (D2-03): omit " +
      "commands-directory discovery and the deploy command leaves the golden.",
  },
  {
    id: "discovery.ruleFrontmatter",
    feature: "Rule frontmatter fields parsed into instruction metadata",
    factRefs: [FACT.CR1],
    status: "supported",
    confidence: "fixture",
    fixture: "ignored-rules",
    verifiedFacts: [FACT.CR1],
    notes:
      "CR1 entire: ignored-rules carries alwaysApply on valid.mdc and globs on scoped.mdc; " +
      "the golden records description, alwaysApply and globs on the matching rules. " +
      "Deletion test (D2-03): stop parsing rule frontmatter and those fields leave the golden.",
  },
  {
    id: "mcp.probe",
    feature: "MCP server runtime availability",
    factRefs: [FACT.CM4],
    status: "unknown",
    confidence: "doc",
    noFixturePossible:
      "CM4 requires explicit runtime confirmation; the resolver marks every MCP server " +
      "unknown and an unknown claims nothing (§11.3), so no fixture can make this entry " +
      "the operative cause of a confident golden value (H1-28).",
    notes: "Probe requires explicit confirmation",
  },
  {
    id: "version.degraded",
    feature: "Degraded scan when cursor --version fails",
    factRefs: [FACT.CV2],
    status: "supported",
    confidence: "doc",
    noFixturePossible:
      "CV2 is exercised by the version probe path, but golden fixtures mock " +
      "detectCursorVersion from version.txt so no corpus fixture makes CLI failure " +
      "the operative cause of a confident golden value (H1-28).",
    notes: "Degraded mode continues read-only discovery when CLI missing",
  },
  {
    id: "discovery.agents",
    feature: "Subagent markdown files discovered from .cursor/agents/**/*.md",
    factRefs: [FACT.CA1],
    status: "supported",
    confidence: "fixture",
    fixture: "basic",
    verifiedFacts: [FACT.CA1],
    notes:
      "CA1 entire: basic declares example.md under .cursor/agents/ and the golden records " +
      "the agent with that path. Deletion test (D4-01): skip agents-directory discovery and " +
      "agents becomes empty.",
  },
  {
    id: "discovery.skills",
    feature: "Skills discovered from .cursor/skills/<name>/SKILL.md",
    factRefs: [FACT.CS1],
    status: "supported",
    confidence: "fixture",
    fixture: "basic",
    verifiedFacts: [FACT.CS1],
    notes:
      "CS1 entire: basic declares example under .cursor/skills/example/SKILL.md and the " +
      "golden records the skill with that path. Deletion test (D4-01): skip skills-directory " +
      "discovery and the example skill leaves the golden.",
  },
  {
    id: "discovery.projectBoundary",
    feature: "Scanned projectPath is the discovery workspace boundary",
    factRefs: [FACT.CW1],
    status: "supported",
    confidence: "doc",
    noFixturePossible:
      "CW1 registry text cites repo root as the directory containing .git, but Capsight " +
      "anchors Cursor discovery on the scanned projectPath (CW5) without consulting .git " +
      "markers; no golden pins a .git-dependent boundary delta (H1-28).",
  },
  {
    id: "discovery.scopedMetadata",
    feature: "Collect .cursor/ metadata only at the scanned workspace path",
    factRefs: [FACT.CW2],
    status: "supported",
    confidence: "doc",
    fixture: "basic",
    verifiedFacts: [],
    notes:
      "CW2: basic isolation test plants ancestor .cursor/rules and the golden is unchanged, " +
      "consistent with single-scope collection. Walk is not matrix-gated yet, so unfounding " +
      "this entry would not change the golden — promotion refused (D5-06, H1-28).",
  },
  {
    id: "discovery.nestedAgentsMd",
    feature: "Collect AGENTS.md only at each discovery scope root",
    factRefs: [FACT.CW3],
    status: "supported",
    confidence: "doc",
    noFixturePossible:
      "discoverInstructions reads AGENTS.md only at each scope root, not recursively in " +
      "subdirectories; no §11.2 golden records a nested AGENTS.md path as the operative cause " +
      "of a confident value (H1-28).",
  },
  {
    id: "rules.applicationMode",
    feature: "Rule alwaysApply, globs, and description control application mode",
    factRefs: [FACT.CR2],
    status: "unknown",
    confidence: "doc",
    noFixturePossible:
      "CR2 records runtime application semantics (always included, file-scoped, intelligent apply); " +
      "the resolver marks every instruction capability unknown and an unknown claims nothing " +
      "(§11.3), so no fixture can make this entry the operative cause of a confident golden value (H1-28).",
    notes: "Frontmatter fields parsed under discovery.ruleFrontmatter (CR1); application mode not resolved in v1",
  },
  {
    id: "discovery.instructionTypes",
    feature: "Rules and AGENTS.md map to typed instructions[] entries",
    factRefs: [FACT.CR3],
    status: "supported",
    confidence: "fixture",
    fixture: "basic",
    verifiedFacts: [FACT.CR3],
    notes:
      "CR3 entire: basic declares a .mdc rule as type rule and AGENTS.md as type AGENTS.md; " +
      "the golden records both instruction types in discovery.instructions. " +
      "Deletion test (D4-02): skip instruction discovery and both entries leave the golden.",
  },
  {
    id: "settings.userJson",
    feature: "Discover readable user JSON settings when install path is stable",
    factRefs: [FACT.CSet3],
    status: "supported",
    confidence: "doc",
    noFixturePossible:
      "CSet3 discovers user settings at an OS-specific path outside projectPath; §11.2 goldens " +
      "record only project-scoped discovery layers, so no fixture can make this entry the " +
      "operative cause of a confident golden value (H1-28).",
    notes: "User settings path varies by OS (CSet1); project-level settings path unknown (CSet2)",
  },
] as const satisfies readonly FeatureCompatibility[];

const CURSOR_PLATFORM = "cursor";

/** Cross-platform consumption claims for Cursor (EC-01). */
export const COMPAT_MATRIX_ENTRIES = [
  {
    id: "compat.cursor.agent-markdown",
    resourceClass: RESOURCE_CLASS.AGENT_MARKDOWN,
    platform: CURSOR_PLATFORM,
    support: "supported",
    factRefs: [FACT.CA1],
    confidence: "doc",
    enforcement: "enforced",
    reason: "Cursor discovers subagents from markdown files under the agents directory (CA1).",
  },
  {
    id: "compat.cursor.skill-directory",
    resourceClass: RESOURCE_CLASS.SKILL_DIRECTORY,
    platform: CURSOR_PLATFORM,
    support: "supported",
    factRefs: [FACT.CS1],
    confidence: "doc",
    enforcement: "enforced",
    reason: "Cursor discovers skills from SKILL.md files in skill subdirectories (CS1).",
  },
  {
    id: "compat.cursor.command-markdown",
    resourceClass: RESOURCE_CLASS.COMMAND_MARKDOWN,
    platform: CURSOR_PLATFORM,
    support: "supported",
    factRefs: [FACT.CS3],
    confidence: "doc",
    enforcement: "enforced",
    reason: "Cursor discovers slash commands from markdown files under the commands directory (CS3).",
  },
  {
    id: "compat.cursor.instruction-agents-md",
    resourceClass: RESOURCE_CLASS.INSTRUCTION_AGENTS_MD,
    platform: CURSOR_PLATFORM,
    support: "supported",
    factRefs: [FACT.CW3],
    confidence: "doc",
    enforcement: "advisory",
    reason: "Cursor reads AGENTS.md at the project root and in nested subdirectories (CW3).",
  },
  {
    id: "compat.cursor.instruction-claude-md",
    resourceClass: RESOURCE_CLASS.INSTRUCTION_CLAUDE_MD,
    platform: CURSOR_PLATFORM,
    support: "not-supported",
    factRefs: [FACT.CR3],
    confidence: "doc",
    enforcement: "enforced",
    reason: "Cursor does not read CLAUDE.md; it loads AGENTS.md and project rules (CR3).",
  },
  {
    id: "compat.cursor.instruction-claude-local-md",
    resourceClass: RESOURCE_CLASS.INSTRUCTION_CLAUDE_LOCAL_MD,
    platform: CURSOR_PLATFORM,
    support: "not-supported",
    factRefs: [FACT.CR3],
    confidence: "doc",
    enforcement: "enforced",
    reason: "Cursor does not read CLAUDE.local.md; it loads AGENTS.md and project rules (CR3).",
  },
  {
    id: "compat.cursor.instruction-rule-mdc",
    resourceClass: RESOURCE_CLASS.INSTRUCTION_RULE_MDC,
    platform: CURSOR_PLATFORM,
    support: "supported",
    factRefs: [FACT.CR1, FACT.CR4],
    confidence: "doc",
    enforcement: "advisory",
    reason: "Cursor reads .mdc rule files under the rules directory (CR1, CR4).",
  },
  {
    id: "compat.cursor.instruction-cursorrules",
    resourceClass: RESOURCE_CLASS.INSTRUCTION_CURSORRULES,
    platform: CURSOR_PLATFORM,
    support: "supported",
    factRefs: [FACT.CR3],
    confidence: "doc",
    enforcement: "advisory",
    reason: "Cursor still reads the legacy .cursorrules file at the repository root.",
  },
  {
    id: "compat.cursor.instruction-fallback-doc",
    resourceClass: RESOURCE_CLASS.INSTRUCTION_FALLBACK_DOC,
    platform: CURSOR_PLATFORM,
    support: "not-supported",
    factRefs: [FACT.CR3],
    confidence: "doc",
    enforcement: "enforced",
    reason: "Cursor does not use Codex-style project_doc_fallback_filenames; it loads AGENTS.md and rules (CR3).",
  },
  {
    id: "compat.cursor.mcp-json-config",
    resourceClass: RESOURCE_CLASS.MCP_JSON_CONFIG,
    platform: CURSOR_PLATFORM,
    support: "supported",
    factRefs: [FACT.CM1],
    confidence: "doc",
    enforcement: "enforced",
    reason: "Cursor reads MCP servers declared in project mcp.json configuration (CM1).",
  },
  {
    id: "compat.cursor.mcp-toml-config",
    resourceClass: RESOURCE_CLASS.MCP_TOML_CONFIG,
    platform: CURSOR_PLATFORM,
    support: "not-supported",
    factRefs: [FACT.CM1],
    confidence: "doc",
    enforcement: "enforced",
    reason: "Cursor does not read Codex TOML mcp_servers blocks; it uses JSON MCP configuration (CM1).",
  },
  {
    id: "compat.cursor.settings-json",
    resourceClass: RESOURCE_CLASS.SETTINGS_JSON,
    platform: CURSOR_PLATFORM,
    support: "supported",
    factRefs: [FACT.CSet3],
    confidence: "doc",
    enforcement: "unknown",
    reason: "Cursor may expose readable JSON settings layers where install paths are stable (CSet3).",
  },
  {
    id: "compat.cursor.settings-toml",
    resourceClass: RESOURCE_CLASS.SETTINGS_TOML,
    platform: CURSOR_PLATFORM,
    support: "not-supported",
    factRefs: [FACT.CSet1],
    confidence: "doc",
    enforcement: "enforced",
    reason: "Cursor does not read Codex TOML config files; it uses JSON settings (CSet1).",
  },
] as const satisfies readonly CompatMatrixEntry[];

export const VERSION_MATRIX: readonly FeatureCompatibility[] = MATRIX_ENTRIES;

export type MatrixId = (typeof MATRIX_ENTRIES)[number]["id"];

export const MATRIX = Object.freeze(
  Object.fromEntries(MATRIX_ENTRIES.map((entry) => [entry.id, entry.id])),
) as { readonly [K in MatrixId]: K };

export function isMatrixId(value: string): value is MatrixId {
  return MATRIX_ENTRIES.some((entry) => entry.id === value);
}

export { compareSemver } from "../../../core/version/semver.js";

/**
 * Resolve a matrix feature for a detected Cursor version.
 * Unknown CLI version or missing matrix entry yields `status: "unknown"`.
 */
export function lookupFeature(
  id: MatrixId,
  version: string,
): FeatureCompatibility | undefined {
  const entry = VERSION_MATRIX.find((candidate) => candidate.id === id);
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

  if (entry.maxVersion) {
    const comparison = compareSemver(version, entry.maxVersion);
    if (comparison === null || comparison > 0) {
      return { ...entry, status: "unsupported" };
    }
  }

  return entry;
}

export interface ResolveEnforcementInput {
  matrixId: MatrixId;
  /** Detected Cursor version, or `"unknown"` in degraded mode (§8.3). */
  version: string;
  baseline?: Enforcement;
}

export interface EnforcementDecision {
  enforcement: Enforcement;
  unfounded: boolean;
  matrixRef: MatrixId;
}

/**
 * The single place where a resolver rule turns into an `enforcement` verdict.
 * Version comparison never happens outside this module (§13 invariant 11).
 */
export function resolveEnforcement(input: ResolveEnforcementInput): EnforcementDecision {
  const { matrixId, version } = input;
  const baseline = input.baseline ?? "enforced";

  const entry = MATRIX_ENTRIES.find((candidate) => candidate.id === matrixId);
  if (!entry) {
    return { enforcement: "unknown", unfounded: true, matrixRef: matrixId };
  }

  if (version === "unknown") {
    return { enforcement: "unknown", unfounded: true, matrixRef: matrixId };
  }

  const resolved = lookupFeature(matrixId, version)!;
  if (resolved.status !== "supported") {
    return { enforcement: "unknown", unfounded: true, matrixRef: matrixId };
  }

  return { enforcement: baseline, unfounded: false, matrixRef: matrixId };
}

export function gateCapability(matrixRef: MatrixId, version: string): EnforcementDecision {
  return resolveEnforcement({ matrixId: matrixRef, version });
}

export function gateCollision(matrixRef: MatrixId, version: string): EnforcementDecision {
  return resolveEnforcement({ matrixId: matrixRef, version });
}

export interface DiscoveryGate {
  enforcement: Enforcement;
  unfounded: boolean;
}

export function gateDiscovery(matrixRef: MatrixId, version: string): DiscoveryGate {
  const decision = resolveEnforcement({ matrixId: matrixRef, version });
  return {
    enforcement: decision.enforcement,
    unfounded: decision.unfounded,
  };
}

/**
 * Apply the matrix gate to a `Warning` that asserts platform behaviour.
 * When the matrix does not found the claim the warning becomes undetermined.
 */
export function gateWarning(
  warning: Warning,
  matrixRef: MatrixId,
  version: string,
): Warning {
  const decision = resolveEnforcement({
    matrixId: matrixRef,
    version,
    baseline: warning.enforcement ?? "enforced",
  });
  return {
    ...warning,
    matrixRef,
    enforcement: decision.enforcement,
  };
}
