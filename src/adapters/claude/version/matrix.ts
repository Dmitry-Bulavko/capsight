/**
 * Version matrix and verified platform facts.
 *
 * ## When an entry may claim `confidence: "fixture"` (H1-28)
 *
 * `confidence` describes the evidence behind *this entry's own rule*, not
 * behind the §3 facts it cites. An entry may claim `"fixture"` only when a
 * corpus fixture makes every part of that rule the operative cause of a
 * *confident* golden expectation: delete the rule from the resolver and a
 * non-`unknown` value in that fixture's `expected.json` changes. A fixture
 * that merely runs while the rule is present, or that produces only `unknown`
 * for it, is not evidence — an `unknown` claims nothing (§11.3), so an entry
 * whose `status` is `unknown` by construction can never reach `"fixture"`.
 *
 * A rule narrower than the fact it cites is written narrowly: `feature` and
 * `notes` name the edge that is pinned and the ranks that are not. Entries are
 * never split per rank (A1's five scopes, S1's five layers), because §11.4
 * counts *facts* and takes the best entry per fact — splitting could not make
 * that count more honest, and whole-fact attribution can. That is what
 * `verifiedFacts` is for: only a fact a fixture exercises *entire* is counted
 * counted as fixture evidence. Pinning one edge of A1 or one layer of S1 earns the
 * entry its own confidence and earns the fact nothing.
 *
 * `confidence: "doc"` is always permissible: understating evidence cannot
 * inflate the metric, while overstating it makes §11.4 mean less than it says.
 *
 * @see docs/SPEC.md §3, §8, §11.4
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
  /**
   * Why no fixture can ever promote this entry (H1-28) — typically that its
   * rule resolves only `unknown`, which claims nothing (§11.3). Mutually
   * exclusive with `fixture` and `pendingFixture`.
   *
   * The field exists so that "no fixture is owed" is a declaration rather than
   * an absence: an entry that simply forgot `pendingFixture` would otherwise
   * drop out of the owed-fixture backlog silently, and the phase exit criterion
   * "no `pendingFixture` left in the matrix" would be satisfiable by deleting
   * the field instead of by earning the evidence.
   */
  noFixturePossible?: string;
  /**
   * Subset of `factRefs` the named fixture exercises *entire*, as the operative
   * cause of a confident golden expectation. Only these facts are counted
   * as fixture evidence by §11.4; a fact the fixture pins one edge of rests on
   * documentation alone however well founded the entry's own verdict is. Set
   * (possibly empty) on every entry that names a `fixture`, so that the call is
   * made explicitly rather than inferred from `confidence` (H1-28).
   */
  verifiedFacts?: readonly FactId[];
  notes?: string;
}

const MATRIX_ENTRIES = [
  {
    id: "agent.disallowedTools",
    feature: "Agent frontmatter disallowedTools filtering",
    factRefs: [FACT.F2, FACT.F3],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "fixture",
    fixture: "tools-filters",
    verifiedFacts: [FACT.F2],
    notes:
      "disallowedTools applied before tools whitelist; MCP patterns per F3. tools-filters pins " +
      "F2 entire: Read stands in both lists and resolves denied, Write survives the whitelist. " +
      "F3 is pinned only for the mcp__<server> form — no fixture carries mcp__<server>__* or the " +
      "disallowedTools-only mcp__* — so F3 rests on documentation alone in §11.4.",
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
    verifiedFacts: [],
    notes:
      "Empty resolved tools list blocks subagent launch from v2.1.208 (F4). The fixture's agent " +
      "always resolves at least one tool, so the F4 half of this entry's rule is the operative " +
      "cause of nothing and the entry stays at doc.",
  },
  {
    id: "agent.toolAliases",
    feature: "Agent and Task tool name aliases",
    factRefs: [FACT.F11],
    minVersion: "2.1.63",
    status: "supported",
    confidence: "doc",
    fixture: "tools-filters",
    verifiedFacts: [],
    notes:
      "No fixture agent names Task or Agent in tools or disallowedTools, so nothing exercises " +
      "the alias; the entry rests on documentation.",
  },
  {
    id: "context.filter1",
    feature: "Subagent filter 1",
    factRefs: [FACT.T1],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    fixture: "tools-filters",
    verifiedFacts: [],
    notes:
      "The fixture pins the removals for a plain foreground subagent; T1 also carries the " +
      "ExitPlanMode exception for permissionMode: plan, which no context in the corpus has.",
  },
  {
    id: "context.filter2",
    feature: "Background subagent filter 2",
    factRefs: [FACT.T2],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    fixture: "background",
    verifiedFacts: [],
    notes:
      "The background agent whitelists two of the nineteen built-ins T2 keeps, so the surviving " +
      "list itself is pinned by nothing.",
  },
  {
    id: "context.fork",
    feature: "Fork context skips agent configuration filters",
    factRefs: [FACT.T3],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    fixture: "fork",
    verifiedFacts: [],
    notes:
      "Every tool the fork fixture resolves carries enforcement unknown — the parent pool is " +
      "not known statically — so the fixture states the rule without confidently claiming an " +
      "outcome. T3 also claims the parent's system prompt, model and history, which the model " +
      "does not carry at all.",
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
    verifiedFacts: [],
    notes:
      "N5 depth values: 2.1.172-2.1.216 = 5 (not configurable), 2.1.217-2.1.218 = 1, 2.1.219+ = 3. " +
      "The fixture covers N2 (removal at the limit, fork exempt) and the 2.1.219+ default of 3 " +
      "including the CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH override (N3); the pre-2.1.219 values " +
      "of N5 rest on documentation alone until a runtime probe can observe them. Neither fact " +
      "is verified entire (H1-28): N5 has two unobserved version windows, and N2's fork half " +
      "resolves with enforcement unknown in the fixture, which claims nothing (§11.3). The " +
      "removal at the limit is confidently pinned, which is what this entry's own confidence " +
      "rests on.",
  },
  {
    id: "agent.depthLimitDefault",
    feature: "Default subagent spawn depth before 2.1.219",
    factRefs: [FACT.N5],
    changedIn: ["2.1.172", "2.1.217", "2.1.219"],
    observedIn: ["2.1.217"],
    status: "changed",
    confidence: "doc",
    fixture: "version-drift",
    verifiedFacts: [],
    notes:
      "N5 records three different defaults below 2.1.219 (5, then 1) and no fixture or probe " +
      "has observed any of them; the resolver only knows the 2.1.219+ default of 3. The " +
      "version-drift fixture pins 2.1.217 and reproduces the discrepancy, so the depth-limit " +
      "verdict is downgraded to unknown on those versions per §8.4 rather than guessed. Confidence " +
      "downgraded to doc in H1-28: every expectation the drift fixture produces for this entry " +
      "is unknown by design, so it evidences our downgrade and not the platform's defaults.",
  },
  {
    id: FACT.P1,
    feature: "Parent bypassPermissions/acceptEdits overrides agent permissionMode",
    factRefs: [FACT.P1],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    fixture: "permission-inheritance",
    verifiedFacts: [],
    notes:
      "The corpus has a bypassPermissions parent but no acceptEdits parent, so half of the rule " +
      "this entry states is the operative cause of nothing.",
  },
  {
    id: FACT.P2,
    feature: "Parent auto mode ignores agent permissionMode frontmatter",
    factRefs: [FACT.P2],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "fixture",
    fixture: "permission-inheritance",
    verifiedFacts: [FACT.P2],
    notes:
      "P2 entire: the background context declares parentPermissionMode auto, the golden resolves " +
      "permission:auto enforced, and the agent's acceptEdits frontmatter is dropped.",
  },
  {
    id: FACT.P4,
    feature: "permissions.disableBypassPermissionsMode blocks agent bypassPermissions",
    factRefs: [FACT.P4],
    minVersion: "2.1.223",
    status: "supported",
    confidence: "fixture",
    fixture: "settings-permissions",
    verifiedFacts: [FACT.P4],
    notes:
      "Pinned by the `restricted` agent of settings-permissions, whose frontmatter declares " +
      "bypassPermissions while a settings layer sets disableBypassPermissionsMode: the golden " +
      "resolves permission:default enforced. permission-inheritance, which this entry used to " +
      "name, carries no settings layer at all and never exercised the rule (H1-28).",
  },
  {
    id: FACT.P5,
    feature: "Agent permissionMode from frontmatter when no parent override",
    factRefs: [FACT.P5],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    fixture: "permission-inheritance",
    verifiedFacts: [],
    notes:
      "The fixture pins the frontmatter path for acceptEdits and the default; P5 enumerates six " +
      "modes and dontAsk, auto, plan and bypassPermissions never reach it from frontmatter.",
  },
  {
    id: "agent.collisionSameDir",
    feature: "Name collision inside one agent directory loads a single file",
    factRefs: [FACT.A4],
    minVersion: "2.1.0",
    status: "unknown",
    confidence: "doc",
    fixture: "collision-same-dir",
    verifiedFacts: [],
    notes:
      "Only the single-load behaviour is documented; which file wins follows FS read order (A4), " +
      "so the winner stays unknown. Confidence downgraded to doc in H1-28: the entry's status is " +
      "unknown by construction, so everything the fixture produces for it — both candidates " +
      "ambiguous, collision enforcement unknown — is an unknown claim, and unknown claims " +
      "nothing (§11.3).",
  },
  {
    id: "agent.collisionCrossScope",
    feature:
      "Name collision across scopes: managed > --agents CLI > project > user > plugin",
    factRefs: [FACT.A1],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "fixture",
    fixture: "plugin-agents",
    verifiedFacts: [],
    notes:
      "A1 names a full order, but the corpus pins edges of it, not the order: plugin-agents has " +
      "a project and a plugin agent share a name and records the project file as effective, and " +
      "managed-simulation shows a managed bundle shadowing a project agent through a §7.8 " +
      "overlay. No fixture loads a `--agents` CLI layer or a ~/.claude/agents/ layer, so the " +
      "CLI and user ranks rest on documentation alone. The project-over-plugin verdict this " +
      "entry gates is fixture-backed; fact A1 is not verified entire and stays " +
      "on documentation alone in §11.4 (H1-28).",
  },
  {
    id: "agent.collisionNested",
    feature: "Nested project agent directories: closest to cwd wins",
    factRefs: [FACT.A3],
    minVersion: "2.1.178",
    status: "supported",
    confidence: "fixture",
    fixture: "collision-nested",
    verifiedFacts: [FACT.A3],
    notes:
      "A3 entire: the fixture scans from app/, the inner declaration resolves active and the " +
      "outer one shadowed, with the collision record enforced. The fact states one rule and the " +
      "fixture pins it.",
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
    verifiedFacts: [],
    notes:
      "The managed-simulation fixture records the F8 block (enforcement on modelChanges) and " +
      "reports a substitute from allowlist order with effectiveEnforcement unknown. Which model " +
      "the platform actually substitutes is not documented — only the block is a platform claim.",
  },
  {
    id: "agent.pluginFieldLimits",
    feature: "Plugin agents ignore hooks, mcpServers and permissionMode",
    factRefs: [FACT.F9],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    pendingFixture: "plugin-agents",
    notes:
      "The fixture reaches the plugin scope through discovery — its plugin roots are named by " +
      "the fixture (plugin-roots.json), because SPEC §3 documents what a plugin's agents/ " +
      "directory does (A1, A6, A8) but not where an installed plugin lives — yet no plugin " +
      "agent in it declares hooks, mcpServers or permissionMode, so nothing exercises the three " +
      "fields being ignored. Reclassified from fixture to pendingFixture in H1-28: naming a " +
      "fixture that does not carry the case overstates what the corpus covers.",
  },
  {
    id: "skills.preload",
    feature: "Frontmatter skills list preloads skill content",
    factRefs: [FACT.K1],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    fixture: "skills-preload",
    verifiedFacts: [],
    notes:
      "The fixture pins the preload itself; K1's other half — that the field is a preload and " +
      "not an access allowlist — needs a skill the agent does not list, which the corpus lacks.",
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
    verifiedFacts: [],
    notes:
      "R1 is pinned for the project scope only (not for an --add-dir agents directory) and R4 " +
      "only for the named-server case (not for ~/.claude/agents/, --agents/SDK or managed " +
      "settings), so neither fact is exercised entire.",
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
    verifiedFacts: [],
    notes:
      "The fixture pins the project levels: a nested CLAUDE.md, the outer one and CLAUDE.local.md " +
      "all reach the subagent. I1 also names ~/.claude/CLAUDE.md and managed policy files, and " +
      "no fixture carries either, so I1 is not verified entire (H1-28).",
  },
  {
    id: "instructions.builtinKind",
    feature: "Explore and Plan resolve zero instruction sources",
    factRefs: [FACT.I2],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "fixture",
    fixture: "instructions",
    verifiedFacts: [FACT.I2],
    notes:
      "I2 entire: the fixture resolves the same agent under both built-in kinds and both drop " +
      "instructions to denied/enforced, while the plain subagent context keeps all three sources.",
  },
  {
    id: "discovery.addDirAgents",
    feature: "--add-dir attaches the added directory's .claude/agents/",
    factRefs: [FACT.A9],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "fixture",
    fixture: "add-dir",
    verifiedFacts: [FACT.A9],
    notes:
      "A9 attaches agents only; the rest of the added directory's configuration " +
      "is not loaded. Discovery-level, so the gate lands on the discovered " +
      "agent's status rather than on a capability. A9 entire: the golden shows " +
      "vendor-lib's agent attached while its settings.json, .mcp.json and " +
      "CLAUDE.md stay out of the discovery result.",
  },
  {
    id: "discovery.addDirSkills",
    feature: "--add-dir attaches the added directory's .claude/skills/",
    factRefs: [FACT.K12],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "fixture",
    fixture: "add-dir",
    verifiedFacts: [FACT.K12],
    notes:
      "K12 is the deliberate exception to A9 and is [ext], so the add-dir " +
      "fixture is what lifts it above documentation (§8.2). One clause, pinned " +
      "entire: vendor-lib's skill is attached and enforced in the golden.",
  },
  {
    id: "settings.layerPrecedence",
    feature: "Settings layer precedence for permission rules and flags",
    factRefs: [FACT.S1],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "fixture",
    fixture: "settings-permissions",
    verifiedFacts: [],
    notes:
      "The fixture pins the .claude/settings.local.json > .claude/settings.json order: the two " +
      "layers set disableBypassPermissionsMode to different values and the local layer wins. " +
      "The managed, command-line and user ranks of S1 are not pinned here — discovery reads a " +
      "managed layer only through a §7.8 bundle and never reads a CLI layer at all. The " +
      "local-over-project verdict this entry gates is therefore fixture-backed, while fact S1 " +
      "is not verified entire and rests on documentation alone in §11.4 (H1-28).",
  },
  {
    id: "settings.denyPrecedence",
    feature: "permissions.deny is applied last and is not overridden at any level",
    factRefs: [FACT.S2],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "fixture",
    fixture: "settings-permissions",
    verifiedFacts: [],
    notes:
      "The fixture denies Bash and Write in .claude/settings.json while the higher-priority " +
      "local layer allows Write and Bash(npm run test:unit); both allow entries resolve inert. " +
      "Its `permissive` agent whitelists Bash and Write in frontmatter and runs under an " +
      "inherited bypassPermissions parent mode, and both tools still resolve denied — the " +
      "deny-over-frontmatter and deny-over-bypass halves of S2. S2 also claims deny is not " +
      "overridden at *any* level; only the project settings layer carries a deny in the corpus, " +
      "so the fact is not verified entire and rests on documentation alone (H1-28).",
  },
  {
    id: "settings.mcpRuleSyntax",
    feature: "MCP permission rules reject the bracket syntax",
    factRefs: [FACT.S3],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "fixture",
    fixture: "settings-permissions",
    verifiedFacts: [],
    notes:
      "S3 states mcp__server(pattern) is invalid, so the fixture's allow entry grants nothing. " +
      "What a *valid* mcp rule grants is a different claim and is not founded by S3: a deny in " +
      "that form only makes the MCP tools it names undetermined, never a confident verdict. S3 also " +
      "names three valid forms and no fixture pins what they grant, so the fact is not verified " +
      "entire (H1-28).",
  },
  {
    id: "settings.allowGlobIneffective",
    feature: "Unanchored globs in permissions.allow grant nothing",
    factRefs: [FACT.S4],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "fixture",
    fixture: "settings-permissions",
    verifiedFacts: [FACT.S4],
    notes:
      "S4 entire: both globs the fact names, `*` and `mcp__*`, sit in the fixture's allow list " +
      "and both resolve blocked/enforced.",
  },
  {
    id: "settings.denyBareTool",
    feature: "permissions.deny on a bare tool name removes the tool entirely",
    factRefs: [FACT.S5, FACT.S2],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "fixture",
    fixture: "settings-permissions",
    verifiedFacts: [FACT.S5],
    notes:
      "Pinned by the `permissive` agent of the fixture, whose frontmatter whitelists Bash and " +
      "Write: without S5 both would resolve available, and in the golden both are denied. A " +
      "tool the frontmatter already excluded would not have pinned anything. S5 has one clause and " +
      "is verified entire; S2 is also referenced here but is pinned only at one layer, so it is " +
      "not claimed (H1-28).",
  },
  {
    id: "settings.bashPrefixRules",
    feature: "Bash(cmd:*) prefix matching in permission rules",
    factRefs: [FACT.S6],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    noFixturePossible:
      "Both halves of S6 answer a per-invocation question: the prefix decides which command " +
      "lines match, and the position of :* decides where the wildcard applies. Neither says " +
      "what a Bash(...) rule leaves of the session's capability set, so such a rule resolves " +
      "unknown in either action, and an unknown claims nothing (§11.3) and can never be the " +
      "operative cause of a confident golden value (H1-28). The evidence that would promote " +
      "this entry is a verdict of the form \"this command line would be approved\", which is " +
      "the permission engine §2.3 forbids this product to have. The S8 escape does not apply " +
      "either: S8 says the domain: prefix is *required*, so a rule lacking it is malformed and " +
      "an allow in that shape grants nothing, whereas S6 says only that :* is not a wildcard " +
      "away from the end — not that such a rule is invalid. Reading a mid-pattern :* as " +
      "granting nothing would be invented semantics (§13.14).",
    notes:
      "The fixture's Bash(npm run test:*) and Bash(npm run test:unit) entries are both inert " +
      "behind the bare Bash deny and are attributed to settings.denyPrecedence, so no corpus " +
      "rule currently reaches this entry at all; one in a layer without that deny would reach " +
      "it and resolve unknown.",
  },
  {
    id: "settings.pathRules",
    feature: "Read/Edit permission rules use gitignore-like globs",
    factRefs: [FACT.S7],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    noFixturePossible:
      "S7 is wholly a statement about which paths a rule covers — a leading / anchors at the " +
      "project root, // at the filesystem root — and matching a concrete path against a glob " +
      "is the per-invocation decision §2.3 keeps out of this product. A Read/Edit path rule " +
      "therefore resolves unknown in either action, and an unknown claims nothing (§11.3), so " +
      "no fixture can make this entry the operative cause of a confident golden value (H1-28). " +
      "Pinning / against // would require asserting on a resolved path verdict this product " +
      "does not produce and is not going to.",
    notes:
      "The fixture carries both anchoring forms S7 names — allow Read(/src/**) and deny " +
      "Edit(//etc/secrets/**) — and each resolves unknown/unknown through this entry, which is " +
      "all the entry claims. The stage also does not lower the tool-level Read or Edit " +
      "capability on the strength of a path-scoped deny: S7 says which paths the rule covers, " +
      "not what is left of the tool.",
  },
  {
    id: "settings.webFetchRules",
    feature: "A WebFetch allow rule without the domain: prefix grants nothing",
    factRefs: [FACT.S8],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "fixture",
    fixture: "settings-permissions",
    verifiedFacts: [],
    notes:
      "The fixture's allow entry WebFetch(example.net) omits the prefix and resolves " +
      "blocked/enforced; drop the prefix check from the parser and the same entry resolves " +
      "unknown as an ordinary argument-scoped rule, so the rule is the operative cause of a " +
      "confident golden value (H1-28). Only that edge is pinned. S8 states the prefix is " +
      "required but not what the platform does with a *deny* that omits it, so the fixture's " +
      "deny entry WebFetch(example.org) stays unknown; and what a correctly prefixed rule " +
      "grants is not resolved either, since this product does not evaluate rule arguments " +
      "(§2.3) and WebFetch(domain:example.com) resolves unknown. S8 is therefore not verified " +
      "entire and rests on documentation alone in §11.4.",
  },
  {
    id: "settings.denySubagents",
    feature: "permissions.deny Agent(<name>) blocks a named subagent",
    factRefs: [FACT.S9],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    noFixturePossible:
      "Agent(<name>) and its Task alias are argument-scoped rules, and this product resolves " +
      "what the platform applies rather than evaluating rule arguments (§2.3), so a rule of " +
      "this shape resolves unknown in either action. Nor does the deny lower the subagent it " +
      "names: `ResolvedCapability[\"kind\"]` has no subagent member, so there is nothing in the " +
      "capability set for such a rule to act on. Every value the rule causes is therefore " +
      "unknown, and an unknown claims nothing (§11.3).",
    notes:
      "What is not pinned is S9 itself — that the deny blocks the subagent, for builtin and " +
      "user-defined names alike.",
  },
  {
    id: "settings.denySkills",
    feature: "permissions.deny Skill(<name>) blocks a named skill",
    factRefs: [FACT.S10],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    noFixturePossible:
      "The rule acts in one direction only: a Skill or Skill(<name>) deny lowers the skill it " +
      "names to unknown, because §3.5 does not say what such a rule leaves of a preloaded " +
      "skill, and the rule capability itself is argument-scoped and resolves unknown too " +
      "(§2.3). The one confident verdict in this neighbourhood — an allow of a skill a bare " +
      "Skill deny already removed — rests on S2/S5 and is credited to settings.denyPrecedence, " +
      "not here.",
    notes:
      "What is not pinned is S10 itself: that Skill covers every skill and Skill(<name>) / " +
      "Skill(<name> *) one.",
  },
  {
    id: "settings.ruleScope",
    feature:
      "Effect of an allow/ask rule, or of any argument-scoped rule, on the resolved capability set",
    factRefs: [],
    status: "unknown",
    confidence: "doc",
    noFixturePossible:
      "Status unknown by construction, so no fixture can make this rule the operative cause of " +
      "a confident golden value and the entry can never reach confidence: fixture (H1-28).",
    notes:
      "§3.5 documents which rule syntaxes exist, not what an allow entry adds to a session or " +
      "which invocations an argument narrows. The product resolves what the platform applies " +
      "rather than running its own permission engine (§2.3), so a rule of this shape is " +
      "recorded and left unknown instead of being turned into an availability verdict.",
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

/**
 * Name-collision rules discovery can attach to a record. The map is total, so
 * every rule that reaches `gateCollision` has a matrix entry behind it and no
 * collision record can be emitted un-gated; a new rule cannot be spelled here
 * until its entry exists.
 */
export type CollisionRule = typeof FACT.A1 | typeof FACT.A3 | typeof FACT.A4;

const COLLISION_MATRIX_IDS: Record<CollisionRule, MatrixId> = {
  [FACT.A1]: "agent.collisionCrossScope",
  [FACT.A3]: "agent.collisionNested",
  [FACT.A4]: "agent.collisionSameDir",
};

export interface CollisionGate {
  /** Matrix entry the rule was gated on. */
  matrixRef: MatrixId;
  /** Confidence in the collision record (§6). */
  enforcement: Enforcement;
  /**
   * `true` when the matrix does not found a winner for this rule on this
   * version — the entry is unsupported on it, the version was not detected, or
   * the entry is `unknown` by construction (A4 always is, because A4 documents
   * that one file loads but not which). The record must then stay winner-free:
   * a winner is never guessed (§8.2, §8.4).
   */
  winnerUnfounded: boolean;
}

/**
 * Gate a name-collision record produced by discovery. Discovery-level, so the
 * verdict lands on the record rather than on a `ResolvedCapability`, but the
 * version arithmetic stays here (§13 invariant 11).
 */
export function gateCollision(
  rule: CollisionRule,
  version: string,
): CollisionGate {
  const matrixRef = COLLISION_MATRIX_IDS[rule];
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
