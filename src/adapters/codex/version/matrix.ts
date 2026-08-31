/**
 * Codex version matrix and verified platform facts.
 *
 * ## When an entry may claim `confidence: "fixture"` (H1-28)
 *
 * `confidence` describes the evidence behind *this entry's own rule*, not
 * behind the CODEX-FACTS facts it cites. An entry may claim `"fixture"` only
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
 * @see docs/CODEX-FACTS.md, docs/SPEC.md §8, §11.4
 */

import type { CompatMatrixEntry } from "../../../core/compat/matrix.js";
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
   * Corpus directory under `tests/fixtures/codex/` whose `expected.json`
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
    id: "instruction.chain",
    feature: "AGENTS.md instruction chain application",
    factRefs: [FACT.XI1, FACT.XI5],
    status: "supported",
    confidence: "fixture",
    fixture: "agents-precedence",
    verifiedFacts: [FACT.XI1],
    notes:
      "XI1 entire: agents-precedence carries AGENTS.override.md alongside AGENTS.md in one " +
      "directory; discovery picks override only. XI5 merge order is referenced by the resolver " +
      "message but is not the operative cause in this fixture. Deletion test (D1-08): with the " +
      "entry unfounded instruction capabilities return unknown in the golden.",
  },
  {
    id: "instruction.fallback",
    feature: "Fallback instruction filenames from user config",
    factRefs: [FACT.XI3],
    status: "supported",
    confidence: "fixture",
    fixture: "instruction-fallback",
    verifiedFacts: [FACT.XI3],
    notes:
      "XI3 entire: instruction-fallback sets project_doc_fallback_filenames in user " +
      "config and carries CLAUDE.md without AGENTS.md; discovery records the fallback " +
      "instruction. Deletion test (D4-04): unfounding the entry skips fallback filenames " +
      "and instructions becomes empty in the golden.",
  },
  {
    id: "instruction.sizeCap",
    feature: "Combined instruction size cap",
    factRefs: [FACT.XI4],
    status: "supported",
    confidence: "doc",
    noFixturePossible:
      "XI4 requires runtime merge/truncate against project_doc_max_bytes; discovery " +
      "records per-file sizeBytes only with no §11.2 channel for cap enforcement or " +
      "warning, so no fixture can make this entry the operative cause of a confident " +
      "golden value (H1-28).",
    notes: "Default cap 32 KiB per Codex docs; not modeled in v1 scan",
  },
  {
    id: "agent.instructionBased",
    feature: "Instruction-based primary agent (no agents[] markdown files)",
    factRefs: [FACT.XA1],
    status: "supported",
    confidence: "fixture",
    fixture: "basic",
    verifiedFacts: [FACT.XA1],
    notes:
      "XA1 entire: basic declares AGENTS.md and the golden records one synthetic main " +
      "agent sourced from that file. Deletion test (D4-04): unfounding the entry marks the " +
      "synthetic main agent status unknown in the golden.",
  },
  {
    id: "agent.noSeparateAgentsArray",
    feature: "No separate agents[] config array in v1 scan",
    factRefs: [FACT.XA3],
    status: "supported",
    confidence: "doc",
    fixture: "basic",
    verifiedFacts: [],
    notes:
      "basic records one synthetic main agent from AGENTS.md with no separate Codex agents[] " +
      "config array or file-based agent definitions. v1 does not model markdown agent files; " +
      "unfounding would not change the golden because no alternate discovery path exists yet — " +
      "promotion refused (D5-06, H1-28).",
  },
  {
    id: "settings.knownKeysOnly",
    feature: "Parse TOML for known keys; unknown keys as types only",
    factRefs: [FACT.XSet1],
    maxVersion: "0.130.0",
    status: "supported",
    confidence: "fixture",
    fixture: "basic",
    verifiedFacts: [FACT.XSet1],
    notes:
      "XSet1 entire: basic carries experimental_feature_enabled in project .codex/config.toml " +
      "and the golden records unknownFields with type boolean only. version-drift pins 0.131.0 — " +
      "above this entry's maxVersion — so unknownFields are stripped per §8.4 while " +
      "instruction.chain on the same fixture stays enforced. Deletion test (D4-05): " +
      "unfounding the entry strips unknownFields from settings layers in the golden.",
  },
  {
    id: "trust.project",
    feature: "Project trust gate for .codex/ layers",
    factRefs: [FACT.XT1, FACT.XT2],
    status: "supported",
    confidence: "fixture",
    fixture: "trust-untrusted",
    verifiedFacts: [FACT.XT1],
    notes:
      "XT1 entire: trust-untrusted sets accepted false via fixture env; project .codex/ config " +
      "and MCP are absent from discovery and the golden records an enforced warning that project " +
      "layers are not loaded — per §2.4 wording. XT2 storage format remains unknown " +
      "in production. Deletion test (D1-08): unfounding the entry downgrades the warning enforcement.",
  },
  {
    id: "trust.unreadable",
    feature: "Unreadable trust resolves unknown, not blocked",
    factRefs: [FACT.XT3],
    status: "supported",
    confidence: "fixture",
    fixture: "basic",
    verifiedFacts: [FACT.XT3],
    notes:
      "XT3 entire: basic leaves trust unreadable (accepted unknown) while project .codex/ layers " +
      "remain in discovery — not treated as untrusted/blocked. The golden records an info " +
      "warning gated on this entry. Deletion test (D4-04): unfounding the entry removes the " +
      "unknown-trust warning from the golden.",
  },
  {
    id: "instruction.ancestors",
    feature: "Ancestor AGENTS.md included in instruction walk",
    factRefs: [FACT.XR4, FACT.XI2],
    status: "supported",
    confidence: "doc",
    fixture: "nested-instructions",
    verifiedFacts: [],
    notes:
      "nested-instructions scans from project/sub with AGENTS.md at repo root and in sub; both " +
      "appear in discovery, consistent with XR4/XI2 documentation. The walk is not matrix-gated " +
      "yet, so unfounding this entry would not change the golden — no fixture-verified claim " +
      "(H1-28). XR4 and XI2 rest on documentation alone in §11.4.",
  },
  {
    id: "discovery.skills",
    feature: "Skills discovered from .agents/skills/<name>/SKILL.md",
    factRefs: [FACT.XS1],
    status: "supported",
    confidence: "fixture",
    fixture: "basic",
    verifiedFacts: [FACT.XS1],
    notes:
      "XS1 entire: basic declares example under .agents/skills/example/SKILL.md and the " +
      "golden records the skill with that path. Deletion test (D2-04): skip skills-directory " +
      "discovery and skills becomes empty.",
  },
  {
    id: "discovery.skillFrontmatter",
    feature: "Skill frontmatter name and description parsed from SKILL.md",
    factRefs: [FACT.XS3],
    status: "supported",
    confidence: "fixture",
    fixture: "basic",
    verifiedFacts: [FACT.XS3],
    notes:
      "XS3 entire: basic carries name and description in SKILL.md frontmatter and the golden " +
      "records both fields on the skill entry. Deletion test (D2-04): stop parsing skill " +
      "frontmatter and description falls back to unknown in the golden.",
  },
  {
    id: "discovery.mcpProject",
    feature: "Project MCP servers load from .codex/config.toml mcp_servers",
    factRefs: [FACT.XM1, FACT.XSet3],
    status: "supported",
    confidence: "fixture",
    fixture: "basic",
    verifiedFacts: [FACT.XM1, FACT.XSet3],
    notes:
      "XM1 and XSet3 entire: basic declares example and remote under [mcp_servers.*] in " +
      "project .codex/config.toml and the golden records both with that config path. " +
      "Deletion test (D2-04): skip project-scope MCP discovery and mcpServers becomes empty.",
  },
  {
    id: "mcp.transport",
    feature: "MCP transport inferred from command or url",
    factRefs: [FACT.XM2],
    status: "supported",
    confidence: "fixture",
    fixture: "basic",
    verifiedFacts: [FACT.XM2],
    notes:
      "XM2 entire: basic carries command-based example (stdio) and url-based remote (http) " +
      "servers; the golden records transport stdio and http respectively. Deletion test (D2-04): " +
      "stop inferring transport and every server records transport unknown.",
  },
  {
    id: "mcp.envRedact",
    feature: "MCP config records env key names only",
    factRefs: [FACT.XSet4],
    status: "supported",
    confidence: "fixture",
    fixture: "basic",
    verifiedFacts: [FACT.XSet4],
    notes:
      "XSet4 entire: basic carries EXAMPLE_API_KEY in mcp_servers.example env and the golden " +
      "records envKeys without values or secrets in configHash. Deletion test (D2-04): stop " +
      "extracting env keys and envKeys leaves the golden while the hash input changes.",
  },
  {
    id: "discovery.settings",
    feature: "Layered .codex/config.toml settings discovered root to cwd",
    factRefs: [FACT.XR3],
    status: "supported",
    confidence: "fixture",
    fixture: "basic",
    verifiedFacts: [FACT.XR3],
    notes:
      "XR3 entire: basic carries project .codex/config.toml and the golden records a project " +
      "settings layer at that path. Deletion test (D2-04): skip project config layering and " +
      "the settings entry leaves the golden.",
  },
  {
    id: "mcp.probe",
    feature: "MCP server runtime availability",
    factRefs: [FACT.XM3],
    status: "unknown",
    confidence: "doc",
    noFixturePossible:
      "XM3 requires explicit runtime confirmation; the resolver marks every MCP server unknown " +
      "and an unknown claims nothing (§11.3), so no fixture can make this entry the operative " +
      "cause of a confident golden value (H1-28).",
    notes: "Probe requires explicit confirmation",
  },
  {
    id: "version.detect",
    feature: "Codex CLI version from codex --version",
    factRefs: [FACT.XV1],
    status: "supported",
    confidence: "doc",
    noFixturePossible:
      "XV1 is exercised by the version probe path, but golden fixtures mock " +
      "detectCodexVersion from version.txt so no corpus fixture makes CLI stdout " +
      "the operative cause of a confident golden value (H1-28).",
    notes: "Semver parsed from codex --version stdout",
  },
  {
    id: "version.degraded",
    feature: "Degraded scan when codex --version fails",
    factRefs: [FACT.XV2],
    status: "supported",
    confidence: "doc",
    noFixturePossible:
      "XV2 is exercised by the version probe path, but golden fixtures mock " +
      "detectCodexVersion from version.txt so no corpus fixture makes CLI failure " +
      "the operative cause of a confident golden value (H1-28).",
    notes: "Degraded mode continues read-only discovery when CLI missing",
  },
  {
    id: "version.scanBoundary",
    feature: "Only codex --version as external process in ordinary scan",
    factRefs: [FACT.XV3],
    status: "supported",
    confidence: "doc",
    noFixturePossible:
      "XV3 is a Capsight scan boundary invariant; no §11.2 golden records which " +
      "external processes run as the operative cause of a confident value (H1-28).",
    notes: "Product policy: ordinary scan must not execute third-party code (SPEC §0.1)",
  },
  {
    id: "discovery.repoRoot",
    feature: "Project root anchored on directory containing .git",
    factRefs: [FACT.XR1],
    status: "supported",
    confidence: "doc",
    fixture: "nested-instructions",
    verifiedFacts: [],
    notes:
      "nested-instructions scans from project/sub; isolation hook places .git at fixture " +
      "root and ancestor AGENTS.md appears in the golden, consistent with XR1. Walk is not " +
      "matrix-gated yet, so unfounding this entry would not change the golden — no " +
      "fixture-verified claim (H1-28).",
  },
  {
    id: "discovery.rootMarkers",
    feature: "Custom project root via project_root_markers config",
    factRefs: [FACT.XR2],
    status: "supported",
    confidence: "doc",
    noFixturePossible:
      "walkProjectScopes resolves repo root via .git only; project_root_markers from " +
      "config is not read, so no golden pins a custom-marker root delta (H1-28).",
    notes: "Codex supports project_root_markers per docs; Capsight v1 uses .git only",
  },
] as const satisfies readonly FeatureCompatibility[];

const CODEX_PLATFORM = "codex";

/** Cross-platform consumption claims for Codex (EC-01). */
export const COMPAT_MATRIX_ENTRIES = [
  {
    id: "compat.codex.agent-markdown",
    resourceClass: RESOURCE_CLASS.AGENT_MARKDOWN,
    platform: CODEX_PLATFORM,
    support: "not-supported",
    factRefs: [FACT.XA1],
    confidence: "doc",
    enforcement: "enforced",
    reason: "Codex primary agent configuration is instruction-based (AGENTS.md), not markdown agent files (XA1).",
  },
  {
    id: "compat.codex.skill-directory",
    resourceClass: RESOURCE_CLASS.SKILL_DIRECTORY,
    platform: CODEX_PLATFORM,
    support: "supported",
    factRefs: [FACT.XS1],
    confidence: "doc",
    enforcement: "enforced",
    reason: "Codex discovers skills from SKILL.md files under the agents skills directory (XS1).",
  },
  {
    id: "compat.codex.command-markdown",
    resourceClass: RESOURCE_CLASS.COMMAND_MARKDOWN,
    platform: CODEX_PLATFORM,
    support: "not-supported",
    factRefs: [FACT.XA1],
    confidence: "doc",
    enforcement: "enforced",
    reason: "Codex does not document slash-command markdown files; configuration is instruction-based (XA1).",
  },
  {
    id: "compat.codex.instruction-agents-md",
    resourceClass: RESOURCE_CLASS.INSTRUCTION_AGENTS_MD,
    platform: CODEX_PLATFORM,
    support: "supported",
    factRefs: [FACT.XI2],
    confidence: "doc",
    enforcement: "advisory",
    reason: "Codex walks AGENTS.md files from the repository root toward the working directory (XI2).",
  },
  {
    id: "compat.codex.instruction-agents-override-md",
    resourceClass: RESOURCE_CLASS.INSTRUCTION_AGENTS_OVERRIDE_MD,
    platform: CODEX_PLATFORM,
    support: "supported",
    factRefs: [FACT.XI1],
    confidence: "doc",
    enforcement: "advisory",
    reason: "Codex prefers AGENTS.override.md over AGENTS.md in the same directory (XI1).",
  },
  {
    id: "compat.codex.instruction-claude-local-md",
    resourceClass: RESOURCE_CLASS.INSTRUCTION_CLAUDE_LOCAL_MD,
    platform: CODEX_PLATFORM,
    support: "not-supported",
    factRefs: [FACT.XI3],
    confidence: "doc",
    enforcement: "enforced",
    reason: "Codex does not read CLAUDE.local.md by default; only configured fallback filenames apply (XI3).",
  },
  {
    id: "compat.codex.instruction-rule-mdc",
    resourceClass: RESOURCE_CLASS.INSTRUCTION_RULE_MDC,
    platform: CODEX_PLATFORM,
    support: "not-supported",
    factRefs: [FACT.XI2],
    confidence: "doc",
    enforcement: "enforced",
    reason: "Codex does not read Cursor rule (.mdc) files; it loads AGENTS.md chains (XI2).",
  },
  {
    id: "compat.codex.instruction-cursorrules",
    resourceClass: RESOURCE_CLASS.INSTRUCTION_CURSORRULES,
    platform: CODEX_PLATFORM,
    support: "not-supported",
    factRefs: [FACT.XI2],
    confidence: "doc",
    enforcement: "enforced",
    reason: "Codex does not read .cursorrules; it loads AGENTS.md chains (XI2).",
  },
  {
    id: "compat.codex.instruction-fallback-doc",
    resourceClass: RESOURCE_CLASS.INSTRUCTION_FALLBACK_DOC,
    platform: CODEX_PLATFORM,
    support: "supported",
    factRefs: [FACT.XI3],
    confidence: "doc",
    enforcement: "advisory",
    reason: "Codex may load filenames listed in project_doc_fallback_filenames when AGENTS.md is absent (XI3).",
  },
  {
    id: "compat.codex.mcp-json-config",
    resourceClass: RESOURCE_CLASS.MCP_JSON_CONFIG,
    platform: CODEX_PLATFORM,
    support: "not-supported",
    factRefs: [FACT.XM1],
    confidence: "doc",
    enforcement: "enforced",
    reason: "Codex does not read JSON mcp.json configuration; MCP is declared in TOML (XM1).",
  },
  {
    id: "compat.codex.mcp-toml-config",
    resourceClass: RESOURCE_CLASS.MCP_TOML_CONFIG,
    platform: CODEX_PLATFORM,
    support: "supported",
    factRefs: [FACT.XM1],
    confidence: "doc",
    enforcement: "enforced",
    reason: "Codex reads MCP servers from TOML mcp_servers blocks (XM1).",
  },
  {
    id: "compat.codex.mcp-inline-agent",
    resourceClass: RESOURCE_CLASS.MCP_INLINE_AGENT,
    platform: CODEX_PLATFORM,
    support: "not-supported",
    factRefs: [FACT.XA1],
    confidence: "doc",
    enforcement: "enforced",
    reason: "Codex does not read inline MCP declarations in agent frontmatter; configuration is TOML-based (XA1).",
  },
  {
    id: "compat.codex.settings-json",
    resourceClass: RESOURCE_CLASS.SETTINGS_JSON,
    platform: CODEX_PLATFORM,
    support: "not-supported",
    factRefs: [FACT.XSet1],
    confidence: "doc",
    enforcement: "enforced",
    reason: "Codex does not read JSON settings layers; configuration is TOML-based (XSet1).",
  },
  {
    id: "compat.codex.settings-toml",
    resourceClass: RESOURCE_CLASS.SETTINGS_TOML,
    platform: CODEX_PLATFORM,
    support: "supported",
    factRefs: [FACT.XR3],
    confidence: "doc",
    enforcement: "enforced",
    reason: "Codex reads layered config.toml files walking from the repository root toward cwd (XR3).",
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
 * Resolve a matrix feature for a detected Codex version.
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
  /** Detected Codex version, or `"unknown"` in degraded mode (§8.3). */
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
