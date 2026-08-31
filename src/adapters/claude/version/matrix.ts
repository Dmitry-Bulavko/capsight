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

import type { CompatMatrixEntry } from "../../../core/compat/matrix.js";
import { RESOURCE_CLASS } from "../../../core/compat/resource-class.js";
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
  /** Inclusive upper bound; detected version above this resolves the entry as unsupported. */
  maxVersion?: string;
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
    maxVersion: "2.1.499",
    changedIn: ["2.1.208"],
    status: "supported",
    confidence: "doc",
    fixture: "tools-filters",
    verifiedFacts: [],
    notes:
      "Empty resolved tools list blocks subagent launch from v2.1.208 (F4). The fixture's agent " +
      "always resolves at least one tool, so the F4 half of this entry's rule is the operative " +
      "cause of nothing and the entry stays at doc. version-drift pins 2.1.500 — above this " +
      "entry's maxVersion — so whitelist verdicts downgrade to unknown per §8.4 while " +
      "permission:default on the same resolution stays enforced.",
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
    id: "context.foregroundBackground",
    feature:
      "Same agent definition resolves different tool pools in foreground and background",
    factRefs: [FACT.T5],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    fixture: "tools-filters",
    verifiedFacts: [],
    notes:
      "tools-filters resolves foreground and background contexts for the same agent, but the " +
      "background denial of Agent is pinned by context.filter2 (T2), not T5. T5 is matrix-" +
      "referenced here for honest coverage; no fixture in the corpus exercises a confident " +
      "value that moves when foreground/background context alone changes (H1-28).",
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
    factRefs: [FACT.N1, FACT.N2, FACT.N3, FACT.N5, FACT.E3],
    minVersion: "2.1.0",
    changedIn: ["2.1.172", "2.1.217", "2.1.219"],
    status: "supported",
    confidence: "fixture",
    fixture: "depth-limit",
    verifiedFacts: [],
    notes:
      "N5 depth values: 2.1.172-2.1.216 = 5 (not configurable), 2.1.217-2.1.218 = 1, 2.1.219+ = 3. " +
      "The fixture covers N2 (removal at the limit, fork exempt) and the 2.1.219+ default of 3 " +
      "including the CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH override (N3, N1); the pre-2.1.219 values " +
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
    maxVersion: "2.1.216",
    changedIn: ["2.1.172", "2.1.217", "2.1.219"],
    observedIn: ["2.1.217"],
    status: "changed",
    confidence: "doc",
    pendingFixture: "version-drift",
    notes:
      "N5 records three different defaults below 2.1.219 (5, then 1) and no fixture or probe " +
      "has observed any of them; the resolver only knows the 2.1.219+ default of 3. A fixture " +
      "pinning a version below 2.1.219 would downgrade depth-limit verdicts per §8.4. " +
      "version-drift now pins agent.tools maxVersion drift at 2.1.500 instead (G1-04). " +
      "Confidence downgraded to doc in H1-28: every expectation a drift fixture produces for " +
      "this entry is unknown by design, so it evidences our downgrade and not the platform's defaults.",
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
    id: FACT.P3,
    feature: "`auto` as default permission mode on Pro, Max and Team plans",
    factRefs: [FACT.P3],
    minVersion: "2.1.0",
    status: "unknown",
    confidence: "doc",
    noFixturePossible:
      "P3 names the subscription-plan default for permission mode. Plan tier is not discovered " +
      "in an ordinary scan and no fixture carries billing or org-plan context, so the default " +
      "resolves unknown when unprovable (H1-28).",
    notes:
      "Registered rather than omitted so P3 is distinguishable in §11.4 from facts nobody has " +
      "looked at.",
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
    noFixturePossible:
      "A10 is a startup claim about the agent set as a whole: the budget is computed during " +
      "discovery and its warning is carried on ProjectSnapshot.warnings, not on any agent's " +
      "EffectiveConfiguration. Under the current §11.2 golden shape, expected.json records " +
      "discovery entities and, per resolution, capabilities, reasons and warnings — but not " +
      "snapshot-level warnings — so this rule has no channel to pin and the deletion test has " +
      "nothing to move (H1-28). A NormalizedDiscovery.warnings channel could hold the value in " +
      "principle; it is not added here because a corpus case would also have to carry ~60 000 " +
      "characters of agent description, recorded verbatim in the golden, to cross the 15 000-token " +
      "budget. The threshold and estimate are pinned by unit tests, which §11.4 deliberately " +
      "does not count.",
    notes:
      "The invalid-agents fixture this entry used to owe covers the A7 skip reasons only; it " +
      "was never the missing piece, because the warning would not reach that fixture's golden.",
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
      "The managed-simulation fixture records the F8 block (enforcement on modelChanges) with " +
      "effectiveEnforcement unknown for the substitute identity. Which model the platform " +
      "actually substitutes is not documented — only the block is a platform claim.",
  },
  {
    id: "agent.pluginFieldLimits",
    feature: "Plugin agents ignore hooks, mcpServers and permissionMode",
    factRefs: [FACT.F9],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "fixture",
    fixture: "plugin-agents",
    verifiedFacts: [FACT.F9],
    notes:
      "The fixture reaches the plugin scope through discovery — its plugin roots are named by " +
      "the fixture (plugin-roots.json), because SPEC §3 documents what a plugin's agents/ " +
      "directory does (A1, A6, A8) but not where an installed plugin lives. H1-28 demoted this " +
      "entry to pendingFixture on the premise that no plugin agent in the corpus declares " +
      "hooks, mcpServers or permissionMode; the premise was wrong. " +
      "plugins/my-plugin/agents/review/security.md declares all three, and the golden carries " +
      "the three ignored-field warnings together with permission:default for that agent. " +
      "Deletion test (D1-06): with the rule removed the same agent resolves " +
      "permission:bypassPermissions from its own frontmatter — a confident and wrong verdict — " +
      "and all three warnings leave the golden. F9 names exactly those three fields and the " +
      "fixture exercises each of them, so the fact is verified entire.",
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
      "not an access allowlist — needs a skill the agent does not list, which the corpus lacks. " +
      "K1 covers skill content preload only: a `.claude/commands/*.md` name in `skills:` resolves " +
      "unknown (D1-14), not preloaded. Deletion test: without the command-kind check the deploy " +
      "entry would flip to preloaded with K1.",
  },
  {
    id: "skills.disableModelInvocation",
    feature: "Skill with disable-model-invocation cannot be preloaded",
    factRefs: [FACT.K4],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "fixture",
    fixture: "skills-preload",
    verifiedFacts: [FACT.K4],
    notes:
      "The fixture's preloader lists two skills: helper preloads, and restricted — which sets " +
      "disable-model-invocation: true — resolves denied. Deletion test (D1-06): with the rule " +
      "removed restricted resolves preloaded, so a confident golden value moves (H1-28). K4 " +
      "states one rule and the fixture carries both of its sides, so the fact is verified " +
      "entire. The verdict is about preloading only: it does not claim what such a skill can " +
      "still do when a user invokes it.",
  },
  {
    id: "skills.missing",
    feature: "Missing or disabled skill in frontmatter skills list is skipped",
    factRefs: [FACT.K5],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    noFixturePossible:
      "The rule's only product is an unknown capability, and an unknown claims nothing " +
      "(§11.3), so no fixture can make it the operative cause of a confident golden value " +
      "(H1-28). Structural rather than a gap in the corpus: a name in `skills:` that the scan " +
      "did not discover may be absent, disabled, or declared in a scope this scan does not " +
      "read, and §3.6 records that the platform skips it to a debug log rather than what the " +
      "session is left holding — so there is no confident verdict for a fixture to pin. " +
      "Adding such a name to skills-preload would add one more unknown and no evidence.",
  },
  {
    id: "skills.denyBeatsAllowedTools",
    feature:
      "A settings deny of a bare tool leaves a skill's allowed-tools pre-approval of that tool with nothing to approve",
    factRefs: [FACT.K8, FACT.K6, FACT.S2, FACT.S5],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "fixture",
    fixture: "skill-allowed-tools",
    verifiedFacts: [],
    notes:
      "The fixture's deployer skill pre-approves Write and Bash(git push:*) while the project " +
      "settings deny bare Write. The Write pre-approval resolves to a finding that states the " +
      "pre-approval has no effect; drop this rule and the same entry resolves to the ordinary " +
      "K6/K7 finding that the skill pre-approves a sensitive tool — a confident claim about the " +
      "opposite state of affairs (H1-28). The Bash entry keeps the K6/K7 finding, so both " +
      "branches are in one golden. " +
      "Narrower than K8 in two ways. Only a bare-tool deny is acted on: that is the one deny " +
      "form whose effect §3.5 states outright (S5 removes the tool from the session), whereas " +
      "what a deny of the form Bash(rm:*) leaves of a pre-approval is the per-invocation " +
      "question §2.3 keeps out of this product, so such a pair stays a plain K6/K7 finding. And " +
      "the rule acts in one direction only — it withdraws a claim about a pre-approval, it never " +
      "adds a capability. K8 says the deny wins *always*, over every deny form, so the fact is " +
      "not exercised entire and rests on documentation alone in §11.4. " +
      "The two facts agree here, and the rule acted on is the S2 one. K8 speaks of a *global* " +
      "deny beating allowed-tools; S2 says a deny at any level is not overridden anywhere. " +
      "Acting on a project-layer deny therefore rests on S2, the broader statement, rather than " +
      "on a widened reading of the word global in K8.",
  },
  {
    id: "skills.allowedToolsUntrusted",
    feature:
      "Project skill allowed-tools pre-approval applies without accepted folder trust",
    factRefs: [FACT.K7],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    fixture: "skill-allowed-tools",
    verifiedFacts: [],
    notes:
      "skill-allowed-tools scans with trust.accepted false and emits K6/K7 security " +
      "findings for deployer's allowed-tools patterns — the pre-approval is recorded as a " +
      "finding, not suppressed by missing trust. K7's `-p`/headless qualifier is not pinned: " +
      "the fixture resolves foreground-subagent only, so that half rests on documentation " +
      "alone in §11.4 (H1-28).",
  },
  {
    id: "skills.disallowedToolsActive",
    feature: "SKILL.md disallowed-tools shrinks the tool pool while a skill is active",
    factRefs: [FACT.K9],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    noFixturePossible:
      "K9 acts on the tool pool while a skill is active — a runtime invocation state an " +
      "ordinary scan does not enter (§2.1). Discovery records skill metadata but does not " +
      "read `disallowed-tools` from SKILL.md, and §11.2 has no channel for a per-skill " +
      "active pool delta, so no fixture can make K9 the operative cause of a confident golden " +
      "value (H1-28).",
    notes:
      "Registered rather than omitted so K9 is distinguishable in §11.4 from facts nobody " +
      "has looked at.",
  },
  {
    id: "skills.settingsOverrides",
    feature: "skillOverrides settings key manages skills without editing the skill file",
    factRefs: [FACT.K10],
    status: "unknown",
    confidence: "doc",
    noFixturePossible:
      "§3.6 states that the key exists and what it is for, and nothing else: not where it sits " +
      "in a settings file, not what it contains, not which skill property it can change and not " +
      "which of the S1 layers may carry it. A fixture cannot supply that. A fixture is an input " +
      "this project authors together with its golden, so writing a skillOverrides block into a " +
      "settings file and asserting a resolution over it would record an invented schema as " +
      "though it were platform behaviour (§13.14) — the fixture would prove only that the " +
      "resolver reads what the same commit made up. The missing evidence is documentary: the " +
      "shape of the key. Until §3.6 carries it, the key is not read at discovery and no rule " +
      "cites it, so every question about it resolves unknown (§8.2) and an unknown claims " +
      "nothing (§11.3).",
    notes:
      "Registered rather than omitted so that the refusal is visible: without an entry K10 would " +
      "be indistinguishable in §11.4 from a fact nobody has looked at.",
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
    confidence: "fixture",
    fixture: "trust-inline-mcp",
    verifiedFacts: [],
    notes:
      "The fixture's `hooked` agent is project-scoped and declares frontmatter hooks while the " +
      "project trust record is not accepted, so its hooks capability resolves blocked and " +
      "enforced on the R5 reason. Deletion test (D1-06): with the rule removed that blocked " +
      "capability leaves the golden altogether. Only R5's first clause is pinned — the " +
      "exemption for user-level agents and --agents needs a home directory or a CLI flag no " +
      "project fixture carries — so the fact is not verified entire. `blocked` records which " +
      "resource the platform holds behind the trust dialog; it is not a claim that hooks " +
      "cannot run by some other route (§2.4).",
  },
  {
    id: "trust.parentFolder",
    feature: "Parent-folder trust does not satisfy containing-folder trust",
    factRefs: [FACT.R2],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    fixture: "nested-project",
    verifiedFacts: [],
    notes:
      "trust-records.json accepts only the repository root (`.`); `mid-hooked` at svc/ " +
      "declares frontmatter hooks and stays blocked while repo-root trust is seeded, " +
      "citing R2 on the hooks capability. Deletion test not yet wired — confidence stays " +
      "doc until treating parent-folder trust as sufficient flips mid-hooked to available " +
      "(H1-28). R2's second clause — automatic `-p`/SDK trust for settings-file hooks — is " +
      "session-mode runtime state with no static scan channel, so it rests on documentation " +
      "alone in §11.4.",
  },
  {
    id: "trust.addDirSeparate",
    feature: "--add-dir folder requires its own trust record",
    factRefs: [FACT.R6],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "fixture",
    fixture: "add-dir",
    verifiedFacts: [],
    notes:
      "trust-records.json accepts only the scan root; vendor-auditor's inline MCP stays blocked " +
      "while the project would pass R1. Deletion test: reuse project trust for the added " +
      "directory and the same capability flips to available. R6 is pinned for the add-dir " +
      "folder only — not for agents discovered from the project tree itself.",
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
    id: "instructions.subagentPrompt",
    feature:
      "Subagent system prompt comes from agent file body plus environment basics",
    factRefs: [FACT.I4],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    noFixturePossible:
      "I4 claims the subagent system prompt is the agent file body plus environment basics, " +
      "not the full Claude Code main prompt. §11.2 goldens carry instruction sources (I1) and " +
      "capabilities but no system-prompt field, so no fixture can make I4 the operative cause of " +
      "a confident golden value (H1-28).",
    notes:
      "Registered rather than omitted so I4 is distinguishable in §11.4 from facts nobody has " +
      "looked at.",
  },
  {
    id: "discovery.upwardWalkAgents",
    feature:
      "Upward walk from cwd discovers every `.claude/agents/` between cwd and repo root",
    factRefs: [FACT.A2],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "fixture",
    fixture: "nested-project",
    verifiedFacts: [FACT.A2],
    notes:
      "A2 entire: cwd.txt scans from svc/worker/ and the golden carries leaf at cwd, mid one " +
      "hop up and outer at the repository root — three distinct agents directories on the walk " +
      "path, each with an active agent. Deletion test: stop collecting intermediate scopes and " +
      "only the leaf agent remains in the golden.",
  },
  {
    id: "discovery.recursiveAgentDirs",
    feature:
      "Agent directories are scanned recursively; identity is the `name` field only",
    factRefs: [FACT.A5],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "fixture",
    fixture: "collision-same-dir",
    verifiedFacts: [FACT.A5],
    notes:
      "A5 entire: the fixture's reviewer-duplicate.md lives under .claude/agents/extra/ but " +
      "declares name reviewer, so recursive discovery surfaces it as a second reviewer " +
      "candidate colliding on name rather than on path. Deletion test: scan only the agents " +
      "root without recursing into subfolders and the extra/ file leaves the golden.",
  },
  {
    id: "discovery.pluginScopedId",
    feature:
      "Plugin agent scoped id includes plugin name and subdirectory segments",
    factRefs: [FACT.A6],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "fixture",
    fixture: "plugin-agents",
    verifiedFacts: [FACT.A6],
    notes:
      "A6 entire: agents/review/security.md in plugin my-plugin resolves " +
      "pluginScopedId my-plugin:review:security in the golden. Deletion test: drop the " +
      "subdirectory segments from the id builder and the same record becomes my-plugin:security.",
  },
  {
    id: "discovery.invalidAgentSkip",
    feature: "Invalid project agent files are registered with a skip reason",
    factRefs: [FACT.A7],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "fixture",
    fixture: "invalid-agents",
    verifiedFacts: [FACT.A7],
    notes:
      "A7 entire: the fixture carries all five documented skip reasons — bad-yaml, no-name, " +
      "bad-name-chars (dash and colon forms), and no-description — each as an invalid agent " +
      "record with the matching invalidReason. Deletion test: stop emitting invalid records " +
      "and every skipped file disappears from the golden.",
  },
  {
    id: "discovery.pluginFilenameFallback",
    feature:
      "Plugin agent without usable frontmatter loads under its file name",
    factRefs: [FACT.A8],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "fixture",
    fixture: "plugin-agents",
    verifiedFacts: [FACT.A8],
    notes:
      "A8 entire: nameless.md has no name field and still loads as nameless with status active. " +
      "The inverse case — the identical project file is skipped (A7) — is pinned by " +
      "invalid-agents, not here. Deletion test: treat unparseable plugin frontmatter like a " +
      "project file and the nameless record becomes invalid.",
  },
  {
    id: "agent.frontmatterRequired",
    feature: "Required agent frontmatter fields `name` and `description`",
    factRefs: [FACT.F1],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    fixture: "invalid-agents",
    verifiedFacts: [],
    notes:
      "F1 names fourteen optional fields plus the two required ones; only the required half is " +
      "pinned here via invalid-agents (no-name, no-description). Optional fields are exercised " +
      "piecemeal across the corpus — tools and disallowedTools in tools-filters, skills in " +
      "skills-preload, hooks and mcpServers in trust-inline-mcp — but no single fixture " +
      "declares all fourteen, so F1 is not verified entire (H1-28).",
  },
  {
    id: "agent.toolsAgentTypesIgnored",
    feature:
      "Agent(type1,type2) type list in subagent `tools` is ignored; the spawn tool itself is selected",
    factRefs: [FACT.F5],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    noFixturePossible:
      "F5 has two halves: the type list is ignored in a subagent definition, and the same syntax " +
      "filters by type in a main session. The corpus resolves only subagent contexts (§11.2), so " +
      "the main-session half has no channel to pin. The subagent half needs an agent whose tools " +
      "list names Agent(types) while the golden asserts the Agent tool is available — but no " +
      "fixture agent uses that pattern yet, and adding one without a main-session counterpart " +
      "would exercise only half of the fact. Until a fixture carries both contexts, the " +
      "operative cause of a confident golden value cannot be attributed to F5 entire (H1-28).",
    notes:
      "tools.ts implements the subagent half: patternMatchesTool treats agent-types like a plain " +
      "Agent/Task head. Registered so the refusal is visible rather than silent.",
  },
  {
    id: "agent.toolsMissingAgent",
    feature: "Missing `Agent` in `tools` blocks subagent spawn",
    factRefs: [FACT.F6],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "fixture",
    fixture: "tools-filters",
    verifiedFacts: [FACT.F6],
    notes:
      "F6 entire: the filtered agent whitelists Read, Write and mcp__github only; the golden " +
      "resolves Agent denied/enforced with the F2 whitelist reason. Deletion test: add Agent " +
      "to the whitelist and the same capability flips to available — a confident value moving " +
      "(H1-28). F2 and F6 share the mechanism here; the fixture message cites F2 because that is " +
      "the resolver path, but the spawn block is what F6 states.",
  },
  {
    id: "agent.modelResolution",
    feature: "Subagent model resolution order",
    factRefs: [FACT.F7, FACT.E6],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    noFixturePossible:
      "F7 names a four-step chain (CLAUDE_CODE_SUBAGENT_MODEL → per-invocation parameter → " +
      "frontmatter → parent session model). E6 is the env-var step of that chain. The " +
      "environment fixture records the env-var key in snapshot.environment.relevant, and " +
      "managed-simulation pins F8's allowlist block on modelChanges — but §11.2 goldens do " +
      "not carry a resolved model field per resolution, so no fixture can make any step of the " +
      "chain the operative cause of a confident golden value (H1-28). Pinning the chain would " +
      "require inventing a model verdict channel this product does not yet emit.",
    notes:
      "Registered rather than omitted so F7 and E6 are distinguishable in §11.4 from facts " +
      "nobody has looked at.",
  },
  {
    id: "agent.initialPromptMainSession",
    feature: "`initialPrompt` applies only in main session",
    factRefs: [FACT.F10],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    noFixturePossible:
      "F10 is a main-session-only claim: initialPrompt is read at discovery but never reaches " +
      "§11.2 resolution goldens, which exercise subagent contexts exclusively. A fixture could " +
      "declare the field and show it in configuration, but that would pin discovery parsing only — " +
      "not that the platform applies it in main session and drops it elsewhere — so the " +
      "session-mode half has no confident verdict to move (H1-28).",
    notes:
      "Discovery stores initialPrompt in AgentConfiguration; resolution does not consume it yet.",
  },
  {
    id: "session.mainAgentPrompt",
    feature: "`--agent` or settings `agent` replaces the main-session system prompt",
    factRefs: [FACT.M4],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    noFixturePossible:
      "M4 is a main-session-only claim: the named agent file body replaces the main prompt " +
      "entirely. §11.2 resolution goldens exercise subagent contexts exclusively, so the " +
      "main-session half has no channel to pin (H1-28).",
    notes:
      "Registered rather than omitted so M4 is distinguishable in §11.4 from facts nobody has " +
      "looked at.",
  },
  {
    id: "session.mainInlineMcp",
    feature: "Inline MCP from the main-session agent file connects at session start",
    factRefs: [FACT.M5, FACT.R1],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    noFixturePossible:
      "M5 claims inline MCP declared in the `--agent` file connects at main-session start " +
      "alongside `.mcp.json`. trust.inline-mcp pins R1's trust gate for project-scoped inline " +
      "MCP in subagent goldens; the main-session startup timing half has no §11.2 channel " +
      "(H1-28).",
    notes:
      "R1 is referenced because M5's inline servers are the same frontmatter field R1 gates " +
      "for trust; only the main-session connect-at-start clause is refused here.",
  },
  {
    id: "skills.skillToolWithoutPreload",
    feature:
      "Subagent without `skills:` preload can still use the `Skill` tool against discovered skills",
    factRefs: [FACT.K2],
    minVersion: "2.1.133",
    status: "supported",
    confidence: "doc",
    fixture: "skill-allowed-tools",
    verifiedFacts: [],
    notes:
      "The runner agent declares no skills: list and no tools whitelist; the golden resolves " +
      "Skill available/enforced while deployer is discovered but not preloaded. That pins the " +
      "tool being offered without a preload, not K2 entire: \"discovers and invokes\" is an " +
      "invocation claim, and an ordinary scan does not invoke anything (§2.1).",
  },
  {
    id: "skills.skillToolWhitelist",
    feature:
      "Skill tool availability follows the agent `tools` / `disallowedTools` whitelist",
    factRefs: [FACT.K3],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    fixture: "basic",
    verifiedFacts: [],
    notes:
      "The basic fixture's backend agent whitelists Read and Grep only; Skill resolves " +
      "denied/enforced with the F2 whitelist reason. That pins the tools-branch half of K3, not K3 " +
      "entire: the fact also names disallowedTools, and no fixture agent lists Skill there while " +
      "leaving it in the inherited pool, so that branch rests on documentation alone (H1-28). " +
      "Deletion test: add Skill to the whitelist and the capability flips to available.",
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
    id: "discovery.commandNamePrecedence",
    feature:
      ".claude/commands/*.md is discovered; a .claude/skills/ entry of the same name wins the name",
    factRefs: [FACT.K11],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "fixture",
    fixture: "basic",
    verifiedFacts: [],
    notes:
      "Discovery-level, so the gate lands on the discovered record rather than on a capability. " +
      "The basic fixture carries both halves: .claude/commands/release-notes.md has no " +
      "counterpart and is reported, while .claude/commands/api-helper.md collides with the " +
      "skill of that name and does not reach the golden. Reverse the walk order so commands " +
      "are read first and the api-helper record in the golden changes its path, source and " +
      "description to the command file, which is a confident value moving (H1-28). " +
      "What is pinned is the precedence, not K11 entire. \"Continues to work\" is a claim about " +
      "invocation, and an ordinary scan does not invoke anything (§2.1): the fixture shows the " +
      "command file discovered, which is as far as this product can see. The precedence is also " +
      "pinned within one scope only — the collision that has a rule. A command and a skill of " +
      "the same name in different scopes are two records here, because K11 names the two " +
      "directories and not the A1/A3 scope order, and inventing one would be §13.14. K11 is " +
      "therefore not verified entire and rests on documentation alone in §11.4.",
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
    confidence: "fixture",
    fixture: "settings-permissions",
    verifiedFacts: [],
    notes:
      "Pinned by three project deny entries not inert behind the bare Bash deny: " +
      "`Bash(npm run cover:*)` (trailing :* suffix), `Bash(npm:* run test)` " +
      "(mid-pattern :* treated as literal prefix), and `Bash(npm run test:unit)` " +
      "(literal prefix, no :*). Each resolves available/enforced through this entry, " +
      "so the rule is the operative cause of a confident golden value (H1-28). Only the " +
      ":* position clause is pinned — trailing :* vs mid-pattern :* — not whether a concrete " +
      "command line matches the prefix (§2.3). S6 also states prefix matching for " +
      "Bash(cmd:*) generally; that half is not exercised by any fixture and rests on " +
      "documentation alone in §11.4. The fixture's allow `Bash(npm run test:*)` and local " +
      "allow `Bash(npm run test:unit)` remain inert behind bare Bash deny and are attributed " +
      "to settings.denyPrecedence instead.",
  },
  {
    id: "settings.pathRules",
    feature: "Read/Edit permission rules use gitignore-like globs",
    factRefs: [FACT.S7],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "fixture",
    fixture: "settings-permissions",
    verifiedFacts: [],
    notes:
      "Pinned by allow Read(/src/**) (project-root / anchoring) and deny " +
      "Edit(//etc/secrets/**) (filesystem-root // anchoring). Each resolves available/enforced " +
      "through this entry, so the rule is the operative cause of a confident golden value " +
      "(H1-28). Only the / vs // anchoring clause is pinned — not whether a concrete path " +
      "matches the glob (§2.3). S7 also states gitignore-like glob syntax generally; that half " +
      "is not exercised by any fixture and rests on documentation alone in §11.4. The stage " +
      "does not lower the tool-level Read or Edit capability on the strength of a path-scoped " +
      "deny: S7 says which paths the rule covers, not what is left of the tool.",
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
    id: "settings.additionalDirectories",
    feature:
      "permissions.additionalDirectories extends the file access of a session beyond the project root",
    factRefs: [FACT.S11],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "fixture",
    fixture: "settings-permissions",
    verifiedFacts: [],
    notes:
      "The fixture declares two entries in one layer: the absolute entry resolves " +
      "available/enforced and the relative entry resolves unknown because §3.5 does not state " +
      "how relative entries resolve; drop the key from the resolver and both capabilities leave " +
      "the golden, so the rule is the operative cause of a confident golden value (H1-28). What " +
      "is pinned is the declaration reaching the reported set and path-shape handling: absolute " +
      "entries are reported as absolute with available/enforced, and relative entries are " +
      "reported verbatim with unknown status. Which paths " +
      "inside such a directory an allow/deny rule covers is the S7 question this product does " +
      "not evaluate (§2.3). Nothing here attaches configuration found inside the directory — " +
      "that is the --add-dir rule (A9, K12), not this key. S11 also carries the " +
      "enableAllProjectMcpServers clause, which this entry does not cover, so the fact is not " +
      "verified entire here and rests on documentation alone in §11.4.",
  },
  {
    id: "settings.projectMcpAutoApproval",
    feature:
      "enableAllProjectMcpServers approves the servers declared in .mcp.json without a prompt",
    factRefs: [FACT.S11, FACT.R4],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "fixture",
    fixture: "settings-permissions",
    verifiedFacts: [],
    notes:
      "The fixture sets the key to true in .claude/settings.json and the approval resolves " +
      "available/enforced, with the same reason attached to the .mcp.json server it names; " +
      "drop the key from the resolver and both leave the golden (H1-28). Only `true` is " +
      "founded: §3.5 says what the key does when set and not what its absence or an explicit " +
      "false leaves in place, so those resolve unknown. Trust does not enter the verdict — " +
      "trust is never applied to servers from .mcp.json and blocked_by_trust is reserved for " +
      "R1 and R5 (§7.2), which is why R4 is referenced here; §3 describes no further " +
      "interaction between this key and the trust dialog and none is assumed. Approval is not " +
      "a claim that a server runs: an ordinary scan does not start MCP servers (§7.1), and " +
      "probing is §7.9. S11's additionalDirectories clause is covered by a separate entry, so " +
      "the fact is not verified entire here (H1-28).",
  },
  {
    id: "discovery.builtinInventory",
    feature: "Built-in agent inventory",
    factRefs: [FACT.B1],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    noFixturePossible:
      "B1 names six built-in agents. Discovery emits only file-backed agents from configured " +
      "directories; synthetic builtins are not attached to discovery.agents, so no §11.2 golden " +
      "can make the inventory the operative cause of a confident value (H1-28). Env-driven " +
      "removal (B5, B6) is documented separately and pins only discovery.environment keys.",
    notes:
      "Registered rather than omitted so B1 is distinguishable in §11.4 from facts nobody has " +
      "looked at.",
  },
  {
    id: "discovery.builtinNameOverride",
    feature: "User agent named Explore overrides built-in Explore",
    factRefs: [FACT.B4],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    noFixturePossible:
      "The user-over-builtin override rule requires builtins to appear in discovery alongside " +
      "user-defined agents so a project agent that reuses a built-in name can shadow the " +
      "built-in while keeping its frontmatter model. Discovery does not synthesize builtins " +
      "yet, so no collision record can name a builtin candidate and no model field can be " +
      "compared against the built-in default (H1-28).",
    notes:
      "Registered rather than omitted so B4 is distinguishable in §11.4 from facts nobody has " +
      "looked at.",
  },
  {
    id: "builtin.readOnly",
    feature: "Explore and Plan built-in agents deny Write and Edit",
    factRefs: [FACT.B2],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "fixture",
    fixture: "instructions",
    verifiedFacts: [],
    notes:
      "Pointer moved to the fixture that already carries the case rather than adding the case " +
      "to tools-filters: instructions resolves its docs-writer agent under foreground-subagent, " +
      "explore and plan, and Write and Edit — both allowed by that agent's own tools whitelist " +
      "— resolve available in the first context and denied in the other two. Deletion test " +
      "(D1-06): with the rule removed all four flip back to available. B2's other clause, that " +
      "Explore and Plan carry read-only tools only, is not pinned — the rule names Write and " +
      "Edit and no fixture asserts the rest of the built-in set — so the fact is not verified " +
      "entire.",
  },
  {
    id: FACT.E1,
    feature: "CLAUDE_CODE_DISABLE_BACKGROUND_TASKS forces foreground subagents",
    factRefs: [FACT.E1],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    fixture: "environment",
    verifiedFacts: [],
    notes:
      "The environment fixture records the key in discovery.environment.relevant when set in " +
      "env.json; drop the key from KNOWN_CLAUDE_ENV_EFFECTS and it leaves the golden. E1's " +
      "resolution half — that foreground-only contexts skip Filter 2 — is not read from the env " +
      "var in the resolver yet, so no §11.2 capability delta is pinned (H1-28).",
  },
  {
    id: FACT.E2,
    feature: "CLAUDE_CODE_FORK_SUBAGENT toggles fork mode",
    factRefs: [FACT.E2],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    fixture: "environment",
    verifiedFacts: [],
    notes:
      "Pins the env key in discovery.environment. The fork fixture exercises T3 fork-context " +
      "tool inheritance but does not set this variable; E2's non-interactive default and the " +
      "`0`-disables-everywhere half rest on documentation alone.",
  },
  {
    id: "builtin.disableExplorePlan",
    feature: "CLAUDE_CODE_DISABLE_EXPLORE_PLAN_AGENTS removes Explore and Plan",
    factRefs: [FACT.B5, FACT.E4],
    minVersion: "2.1.198",
    status: "supported",
    confidence: "doc",
    fixture: "environment",
    verifiedFacts: [],
    notes:
      "B5 and E4 state the same env-driven removal; the environment fixture records the key in " +
      "discovery.environment only. Builtin removal from the agent set is not emitted in §11.2 " +
      "goldens yet, so no discovery.agents delta is pinned (H1-28).",
  },
  {
    id: "builtin.disableAllSdk",
    feature: "CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS removes all built-in agent types",
    factRefs: [FACT.B6, FACT.E5],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    fixture: "environment",
    verifiedFacts: [],
    notes:
      "B6 and E5 state the same env-driven removal in non-interactive/SDK contexts; the " +
      "environment fixture pins the key in discovery.environment. The non-interactive " +
      "qualifier and the builtin inventory delta are not pinned in goldens.",
  },
  {
    id: "environment.maxConcurrentSubagents",
    feature: "CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS sets parallel subagent cap",
    factRefs: [FACT.N4, FACT.E7],
    minVersion: "2.1.217",
    status: "supported",
    confidence: "doc",
    fixture: "environment",
    verifiedFacts: [],
    notes:
      "N4 names the default of 20 and E7 the env override; the environment fixture records the " +
      "key and effect in discovery.environment. No §11.2 channel carries the resolved cap, so " +
      "the operative cause of nothing moves in resolution goldens (H1-28).",
  },
  {
    id: FACT.E8,
    feature: "CLAUDE_CODE_DISABLE_AUTO_MEMORY disables frontmatter memory",
    factRefs: [FACT.E8],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    fixture: "environment",
    verifiedFacts: [],
    notes:
      "Pins the env key in discovery.environment. The resolver does not yet gate frontmatter " +
      "memory on this variable, so no configuration or capability delta is pinned.",
  },
  {
    id: "environment.settingsEnv",
    feature: "Settings env block keys injected per session and tool call",
    factRefs: [FACT.E9],
    minVersion: "2.1.0",
    status: "supported",
    confidence: "doc",
    fixture: "environment",
    verifiedFacts: [],
    notes:
      "E9 is [ext]: the environment fixture's .claude/settings.json env block surfaces " +
      "DEPLOY_API_TOKEN and ANTHROPIC_BASE_URL in discovery.environment with origin " +
      "settings.env and without values (§13 invariant 10). Deletion test: drop " +
      "readSettingsEnvKeys from buildPlatformEnvironment and both keys leave the golden.",
  },
] as const satisfies readonly FeatureCompatibility[];

const CLAUDE_PLATFORM = "claude";

/** Cross-platform consumption claims for Claude Code (EC-01). */
export const COMPAT_MATRIX_ENTRIES = [
  {
    id: "compat.claude.agent-markdown",
    resourceClass: RESOURCE_CLASS.AGENT_MARKDOWN,
    platform: CLAUDE_PLATFORM,
    support: "supported",
    factRefs: [FACT.A1, FACT.A2, FACT.A5],
    minVersion: "2.1.0",
    confidence: "doc",
    enforcement: "enforced",
    reason: "Claude Code discovers agents from markdown files under configured agents directories (A1, A2).",
  },
  {
    id: "compat.claude.skill-directory",
    resourceClass: RESOURCE_CLASS.SKILL_DIRECTORY,
    platform: CLAUDE_PLATFORM,
    support: "supported",
    factRefs: [FACT.K1],
    minVersion: "2.1.0",
    confidence: "doc",
    enforcement: "enforced",
    reason: "Claude Code discovers skills from SKILL.md files in skill directories (K1).",
  },
  {
    id: "compat.claude.command-markdown",
    resourceClass: RESOURCE_CLASS.COMMAND_MARKDOWN,
    platform: CLAUDE_PLATFORM,
    support: "supported",
    factRefs: [FACT.K11],
    minVersion: "2.1.0",
    confidence: "doc",
    enforcement: "enforced",
    reason: "Claude Code discovers slash commands from markdown files under the commands directory (K11).",
  },
  {
    id: "compat.claude.instruction-agents-md",
    resourceClass: RESOURCE_CLASS.INSTRUCTION_AGENTS_MD,
    platform: CLAUDE_PLATFORM,
    support: "not-supported",
    factRefs: [FACT.I1],
    minVersion: "2.1.0",
    confidence: "doc",
    enforcement: "enforced",
    reason: "Claude Code does not read AGENTS.md; it loads the CLAUDE.md instruction hierarchy (I1).",
  },
  {
    id: "compat.claude.instruction-agents-override-md",
    resourceClass: RESOURCE_CLASS.INSTRUCTION_AGENTS_OVERRIDE_MD,
    platform: CLAUDE_PLATFORM,
    support: "not-supported",
    factRefs: [FACT.I1],
    minVersion: "2.1.0",
    confidence: "doc",
    enforcement: "enforced",
    reason: "Claude Code does not read AGENTS.override.md; it loads the CLAUDE.md instruction hierarchy (I1).",
  },
  {
    id: "compat.claude.instruction-claude-md",
    resourceClass: RESOURCE_CLASS.INSTRUCTION_CLAUDE_MD,
    platform: CLAUDE_PLATFORM,
    support: "supported",
    factRefs: [FACT.I1],
    minVersion: "2.1.0",
    confidence: "doc",
    enforcement: "advisory",
    reason: "Claude Code loads CLAUDE.md files in the project instruction hierarchy (I1).",
  },
  {
    id: "compat.claude.instruction-claude-local-md",
    resourceClass: RESOURCE_CLASS.INSTRUCTION_CLAUDE_LOCAL_MD,
    platform: CLAUDE_PLATFORM,
    support: "supported",
    factRefs: [FACT.I1],
    minVersion: "2.1.0",
    confidence: "doc",
    enforcement: "advisory",
    reason: "Claude Code loads CLAUDE.local.md files in the project instruction hierarchy (I1).",
  },
  {
    id: "compat.claude.instruction-rule-mdc",
    resourceClass: RESOURCE_CLASS.INSTRUCTION_RULE_MDC,
    platform: CLAUDE_PLATFORM,
    support: "not-supported",
    factRefs: [FACT.I1],
    minVersion: "2.1.0",
    confidence: "doc",
    enforcement: "enforced",
    reason: "Claude Code does not read Cursor rule (.mdc) files; it loads the CLAUDE.md hierarchy (I1).",
  },
  {
    id: "compat.claude.instruction-cursorrules",
    resourceClass: RESOURCE_CLASS.INSTRUCTION_CURSORRULES,
    platform: CLAUDE_PLATFORM,
    support: "not-supported",
    factRefs: [FACT.I1],
    minVersion: "2.1.0",
    confidence: "doc",
    enforcement: "enforced",
    reason: "Claude Code does not read .cursorrules; it loads the CLAUDE.md instruction hierarchy (I1).",
  },
  {
    id: "compat.claude.instruction-fallback-doc",
    resourceClass: RESOURCE_CLASS.INSTRUCTION_FALLBACK_DOC,
    platform: CLAUDE_PLATFORM,
    support: "not-supported",
    factRefs: [FACT.I1],
    minVersion: "2.1.0",
    confidence: "doc",
    enforcement: "enforced",
    reason: "Claude Code does not use Codex-style project_doc_fallback_filenames; it loads CLAUDE.md (I1).",
  },
  {
    id: "compat.claude.mcp-json-config",
    resourceClass: RESOURCE_CLASS.MCP_JSON_CONFIG,
    platform: CLAUDE_PLATFORM,
    support: "supported",
    factRefs: [FACT.R4],
    minVersion: "2.1.0",
    confidence: "doc",
    enforcement: "enforced",
    reason: "Claude Code reads MCP servers declared in project .mcp.json (R4).",
  },
  {
    id: "compat.claude.mcp-toml-config",
    resourceClass: RESOURCE_CLASS.MCP_TOML_CONFIG,
    platform: CLAUDE_PLATFORM,
    support: "not-supported",
    factRefs: [FACT.R4],
    minVersion: "2.1.0",
    confidence: "doc",
    enforcement: "enforced",
    reason: "Claude Code does not read Codex TOML mcp_servers blocks; it uses JSON MCP configuration (R4).",
  },
  {
    id: "compat.claude.mcp-inline-agent",
    resourceClass: RESOURCE_CLASS.MCP_INLINE_AGENT,
    platform: CLAUDE_PLATFORM,
    support: "supported",
    factRefs: [FACT.F1, FACT.R1],
    minVersion: "2.1.0",
    confidence: "doc",
    enforcement: "enforced",
    reason: "Claude Code reads inline mcpServers declared in agent frontmatter (F1, R1).",
  },
  {
    id: "compat.claude.settings-json",
    resourceClass: RESOURCE_CLASS.SETTINGS_JSON,
    platform: CLAUDE_PLATFORM,
    support: "supported",
    factRefs: [FACT.S1],
    minVersion: "2.1.0",
    confidence: "doc",
    enforcement: "enforced",
    reason: "Claude Code reads settings from JSON settings layers (S1).",
  },
  {
    id: "compat.claude.settings-toml",
    resourceClass: RESOURCE_CLASS.SETTINGS_TOML,
    platform: CLAUDE_PLATFORM,
    support: "not-supported",
    factRefs: [FACT.S1],
    minVersion: "2.1.0",
    confidence: "doc",
    enforcement: "enforced",
    reason: "Claude Code does not read Codex TOML config files; it uses JSON settings layers (S1).",
  },
] as const satisfies readonly CompatMatrixEntry[];

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

  if (entry.maxVersion) {
    const comparison = compareSemver(version, entry.maxVersion);
    if (comparison === null || comparison > 0) {
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
        `${entry.minVersion ? ` (requires >= ${entry.minVersion})` : ""}` +
        `${entry.maxVersion ? ` (requires <= ${entry.maxVersion})` : ""}; the feature resolves as unknown (SPEC §8.2).`,
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
