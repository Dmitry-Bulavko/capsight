import path from "node:path";
import type {
  ResolutionReason,
  ResolvedCapability,
  SourceInfo,
} from "../../../core/model/index.js";
import type {
  SettingsLayer,
  SettingsPermissionAction,
  SettingsPermissionRule,
} from "../discovery/types.js";
import { MATRIX, gateCapability, type MatrixId } from "../version/matrix.js";
import {
  AGENT_TOOL_NAMES,
  BACKGROUND_ALLOWED_BUILTIN_TOOLS,
  FILTER_1_REMOVED_TOOLS,
  TEAMMATE_ADDITIONAL_TOOLS,
  isMcpTool,
} from "./tool-tables.js";

/**
 * Settings permission rules as a resolution stage (§4.4 rule 7).
 *
 * Two things this stage is deliberately not. It is not a permission engine
 * (§2.3): it never decides whether a particular Bash command or path would be
 * approved, only what the platform's own rules do to the capability set we
 * report. And it never silently drops a rule — every entry of every
 * `permissions.allow` / `deny` / `ask` array becomes exactly one capability,
 * so a rule this resolver cannot act on is visible as an explicit `unknown`
 * rather than as an absent line.
 *
 * @see docs/SPEC.md §3.5 S1–S11, §4.4 rule 7, §6, §13 invariants 3, 4, 14
 */

/** Tool names the product knows; a rule naming anything else is not acted on. */
const KNOWN_TOOL_NAMES: ReadonlySet<string> = new Set<string>([
  ...BACKGROUND_ALLOWED_BUILTIN_TOOLS,
  ...FILTER_1_REMOVED_TOOLS,
  ...TEAMMATE_ADDITIONAL_TOOLS,
  ...AGENT_TOOL_NAMES,
]);

/** Unanchored globs S4 names as granting nothing. */
const UNANCHORED_ALLOW_GLOBS: ReadonlySet<string> = new Set(["*", "mcp__*"]);

/** How S7 classifies path-glob anchoring in a `Read(...)` / `Edit(...)` argument. */
export type PathGlobAnchor =
  /** Argument starts with `//`; S7 anchors at the filesystem root. */
  | "absolute"
  /** Argument starts with `/` but not `//`; S7 anchors at the project root. */
  | "project-root"
  /** No leading `/` or `//`; S7 does not name this anchoring form. */
  | "no-leading-slash";

/**
 * Classify a Read/Edit rule argument by path-glob anchoring (S7). This is
 * shape only — it does not decide whether a concrete path would match.
 */
export function classifyPathGlobAnchor(argument: string): PathGlobAnchor {
  if (argument.startsWith("//")) {
    return "absolute";
  }
  if (argument.startsWith("/")) {
    return "project-root";
  }
  return "no-leading-slash";
}

/** How S6 classifies the `:*` suffix in a `Bash(...)` rule argument. */
export type BashPrefixShape =
  /** Argument ends with `:*`; S6 treats that suffix as a wildcard. */
  | "trailing-wildcard"
  /** Argument contains `:*` but not at the end; S6 does not treat it as a wildcard. */
  | "mid-pattern-colon-star"
  /** No `:*` in the argument; the rule is a literal prefix. */
  | "literal-prefix";

/**
 * Classify a `Bash(...)` rule argument by where `:*` appears (S6). This is
 * shape only — it does not decide whether a concrete command line would match.
 */
export function classifyBashPrefixShape(argument: string): BashPrefixShape {
  if (argument.endsWith(":*")) {
    return "trailing-wildcard";
  }
  if (argument.includes(":*")) {
    return "mid-pattern-colon-star";
  }
  return "literal-prefix";
}

/** `Head(argument)`; the head never contains parentheses. */
const SCOPED_RULE = /^([^()]+)\((.*)\)$/;

type ParsedRule =
  /** A bare tool name, e.g. `Bash` (S5). */
  | { kind: "bare-tool"; tool: string }
  /** A bare name that is not a tool this product knows. */
  | { kind: "bare-unknown"; name: string }
  /** `Tool(argument)`, e.g. `Bash(npm run test:*)`, `Read(/src/**)`. */
  | { kind: "scoped"; tool: string; argument: string }
  /** A bracket-free MCP rule: `mcp__server`, `mcp__server__tool`, `mcp__server__*` (S3). */
  | { kind: "mcp"; raw: string }
  /** `*` or `mcp__*` (S4). */
  | { kind: "unanchored-glob" }
  /** `mcp__server(pattern)`: S3 states the bracket syntax is invalid. */
  | { kind: "invalid-mcp-bracket" }
  /** A `WebFetch(...)` rule without the `domain:` prefix S8 requires. */
  | { kind: "webfetch-no-domain" }
  /** Syntax §3.5 does not describe. */
  | { kind: "unrecognized" };

/** @see docs/SPEC.md S3, S4, S5, S6, S7, S8 */
export function parseSettingsPermissionRule(raw: string): ParsedRule {
  const pattern = raw.trim();

  if (UNANCHORED_ALLOW_GLOBS.has(pattern)) {
    return { kind: "unanchored-glob" };
  }

  const scoped = SCOPED_RULE.exec(pattern);
  if (scoped) {
    const tool = scoped[1]!.trim();
    const argument = scoped[2]!;
    if (tool.startsWith("mcp__")) {
      return { kind: "invalid-mcp-bracket" };
    }
    if (tool.length === 0 || argument.includes("(") || argument.includes(")")) {
      return { kind: "unrecognized" };
    }
    if (tool === "WebFetch" && !argument.startsWith("domain:")) {
      return { kind: "webfetch-no-domain" };
    }
    return { kind: "scoped", tool, argument };
  }

  if (pattern.includes("(") || pattern.includes(")") || pattern.length === 0) {
    return { kind: "unrecognized" };
  }

  if (isMcpTool(pattern)) {
    // S3: `mcp__server`, `mcp__server__tool` and `mcp__server__*` are the
    // valid bracket-free forms and the only ones. A wildcard anywhere else —
    // `mcp__server*`, `mcp__ser*__tool` — is a shape §3.5 does not describe.
    const segments = pattern.slice("mcp__".length).split("__");
    const valid =
      segments.length > 0 &&
      segments.length <= 2 &&
      segments.every((segment) => segment.length > 0) &&
      !segments[0]!.includes("*") &&
      (segments.length === 1 || segments[1] === "*" || !segments[1]!.includes("*"));
    return valid ? { kind: "mcp", raw: pattern } : { kind: "unrecognized" };
  }

  if (pattern.includes("*")) {
    return { kind: "unrecognized" };
  }

  return KNOWN_TOOL_NAMES.has(pattern)
    ? { kind: "bare-tool", tool: pattern }
    : { kind: "bare-unknown", name: pattern };
}

/** Tool a rule names, when it names one. */
function ruleTool(parsed: ParsedRule): string | undefined {
  switch (parsed.kind) {
    case "bare-tool":
      return parsed.tool;
    case "scoped":
      return parsed.tool;
    default:
      return undefined;
  }
}

/**
 * Matrix entry documenting the rule shape. An argument-scoped rule falls back
 * to `settings.ruleScope`, whose entry is `unknown` by construction: §3.5 says
 * which syntaxes exist, not what they do to the capability set.
 */
function ruleMatrixId(
  parsed: ParsedRule,
  action: SettingsPermissionAction,
): MatrixId {
  switch (parsed.kind) {
    case "unanchored-glob":
      return MATRIX["settings.allowGlobIneffective"];
    case "invalid-mcp-bracket":
    case "mcp":
      return MATRIX["settings.mcpRuleSyntax"];
    case "webfetch-no-domain":
      return MATRIX["settings.webFetchRules"];
    case "bare-tool":
      // S5 is about `deny`; what a bare `allow` adds is a different question
      // and §3.5 does not answer it.
      return action === "deny"
        ? MATRIX["settings.denyBareTool"]
        : MATRIX["settings.ruleScope"];
    case "scoped":
      switch (parsed.tool) {
        case "Bash":
          return MATRIX["settings.bashPrefixRules"];
        case "PowerShell":
          // S6 names Bash(cmd:*) only; PowerShell is not attributed to that fact.
          return MATRIX["settings.ruleScope"];
        case "Read":
        case "Edit":
          return MATRIX["settings.pathRules"];
        case "WebFetch":
          return MATRIX["settings.webFetchRules"];
        case "Agent":
        case "Task":
          return MATRIX["settings.denySubagents"];
        case "Skill":
          return MATRIX["settings.denySkills"];
        default:
          return MATRIX["settings.ruleScope"];
      }
    default:
      return MATRIX["settings.ruleScope"];
  }
}

export interface IndexedSettingsRule {
  rule: SettingsPermissionRule;
  layer: SettingsLayer;
  parsed: ParsedRule;
  source: SourceInfo;
}

function ruleSource(layer: SettingsLayer, rule: SettingsPermissionRule): SourceInfo {
  return {
    platform: "claude",
    scope: layer.scope,
    path: layer.path,
    fieldPath: `permissions.${rule.action}[${rule.index}]`,
  };
}

/**
 * Every rule of every layer, ordered by layer precedence (S1). Order is only
 * about which rule is cited first when several say the same thing: per S2 a
 * `deny` is not outranked by a higher-priority `allow`, so precedence never
 * decides an outcome here.
 */
export function indexSettingsRules(
  layers: readonly SettingsLayer[],
): IndexedSettingsRule[] {
  return [...layers]
    .sort((left, right) => right.priority - left.priority)
    .flatMap((layer) =>
      (layer.permissions?.rules ?? []).map((rule) => ({
        rule,
        layer,
        parsed: parseSettingsPermissionRule(rule.raw),
        source: ruleSource(layer, rule),
      })),
    );
}

/**
 * `disableBypassPermissionsMode` from the highest-priority layer that sets it
 * (S1). A layer that omits the key does not vote; `false` in a lower layer
 * does not lift a `true` above it, and neither does the reverse.
 */
export function resolveDisableBypassPermissionsMode(
  layers: readonly SettingsLayer[],
): { value?: boolean; source?: SourceInfo; contested: boolean } {
  const setting = [...layers]
    .sort((left, right) => right.priority - left.priority)
    .filter((layer) => layer.permissions?.disableBypassPermissionsMode !== undefined);

  const winner = setting[0];
  if (!winner) {
    return { contested: false };
  }

  const value = winner.permissions!.disableBypassPermissionsMode!;
  return {
    value,
    source: {
      platform: "claude",
      scope: winner.scope,
      path: winner.path,
      fieldPath: "permissions.disableBypassPermissionsMode",
    },
    // Layers disagree, so the outcome rests on the S1 order rather than on a
    // single declaration.
    contested: setting.some(
      (layer) => layer.permissions!.disableBypassPermissionsMode !== value,
    ),
  };
}

/**
 * `enableAllProjectMcpServers` from the highest-priority layer that sets it
 * (S1), read exactly like `disableBypassPermissionsMode`: a layer that omits
 * the key does not vote.
 */
export function resolveProjectMcpApproval(
  layers: readonly SettingsLayer[],
): { value: boolean; source: SourceInfo; contested: boolean } | undefined {
  const setting = [...layers]
    .sort((left, right) => right.priority - left.priority)
    .filter((layer) => layer.enableAllProjectMcpServers !== undefined);

  const winner = setting[0];
  if (!winner) {
    return undefined;
  }

  const value = winner.enableAllProjectMcpServers!;
  return {
    value,
    source: {
      platform: "claude",
      scope: winner.scope,
      path: winner.path,
      fieldPath: "enableAllProjectMcpServers",
    },
    contested: setting.some((layer) => layer.enableAllProjectMcpServers !== value),
  };
}

export const PROJECT_MCP_APPROVAL_CAPABILITY_ID = "settings-project-mcp-approval";

/**
 * The S11 approval reason, for the servers the key names. Returned separately
 * so the resolver can attach it to each `.mcp.json` server capability: the
 * effect of the key is on those servers, and a reason that lived only on the
 * settings capability would leave the server itself unexplained.
 *
 * Wording per §2.4: the key removes a prompt, it does not make a server
 * trusted and it is not a security boundary in either direction.
 */
export function projectMcpApprovalReason(
  approval: { value: boolean; source: SourceInfo },
): ResolutionReason {
  return approval.value
    ? reason(
        "declared",
        'Settings set "enableAllProjectMcpServers" to true, so MCP servers declared in ' +
          ".mcp.json are approved without a prompt (S11). Approval is not an observation " +
          "that a server starts or a statement about what it does: an ordinary scan does " +
          "not start MCP servers.",
        approval.source,
        MATRIX["settings.projectMcpAutoApproval"],
      )
    : reason(
        "unknown",
        'Settings set "enableAllProjectMcpServers" to false. §3.5 states what the key does ' +
          "when it approves the servers declared in .mcp.json and not what a false value " +
          "leaves in place, so whether each server is prompted for individually is not " +
          "determined.",
        approval.source,
        MATRIX["settings.projectMcpAutoApproval"],
      );
}

/**
 * The approval as its own capability, so the setting is visible even in a
 * project whose `.mcp.json` declares nothing.
 *
 * Trust is stated rather than assumed. §7.2 applies `blocked_by_trust` only to
 * R1 and R5 and names servers from `.mcp.json` as outside it, and R4 is what
 * says such a server loads without a trust check, so trust does not withhold
 * this approval; §3 describes no further interaction between the key and the
 * trust dialog, and none is invented here.
 */
function buildProjectMcpApprovalCapability(
  approval: { value: boolean; source: SourceInfo; contested: boolean },
  version: string,
): ResolvedCapability {
  const reasons: ResolutionReason[] = [projectMcpApprovalReason(approval)];

  if (approval.value) {
    reasons.push(
      reason(
        "trust",
        "Project trust does not withhold this approval: servers declared in .mcp.json load " +
          "without a trust check (R4), and §7.2 limits blocked_by_trust to inline agent " +
          "servers (R1) and agent frontmatter hooks (R5). §3 states no further interaction " +
          "between this setting and the trust dialog.",
        approval.source,
        MATRIX["settings.projectMcpAutoApproval"],
      ),
    );
  }

  if (approval.contested) {
    reasons.push(
      reason(
        "declared",
        "More than one settings layer sets this key with different values; the layer named " +
          "here is the one that outranks the others (S1).",
        approval.source,
        MATRIX["settings.layerPrecedence"],
      ),
    );
  }

  return gateCapability(
    {
      capabilityId: PROJECT_MCP_APPROVAL_CAPABILITY_ID,
      kind: "permission" as const,
      status: approval.value ? ("available" as const) : ("unknown" as const),
      enforcement: approval.value ? ("enforced" as const) : ("unknown" as const),
      sources: [approval.source],
      reasons,
    },
    MATRIX["settings.projectMcpAutoApproval"],
    version,
  );
}

/** Whether an additionalDirectories entry is an absolute filesystem path. */
export type AdditionalDirectoryPathKind = "absolute" | "relative";

/**
 * Classify an additionalDirectories entry as absolute or relative (S11). A
 * leading `/` is treated as absolute even on Windows, matching how settings
 * paths are written in Claude Code documentation.
 */
export function classifyAdditionalDirectoryPath(entry: string): AdditionalDirectoryPathKind {
  return path.isAbsolute(entry) || entry.startsWith("/") ? "absolute" : "relative";
}

const ADDITIONAL_DIRECTORY_GUARDRAIL =
  "This is a configuration guardrail rather than a complete security boundary, and permission " +
  "rules still apply to paths inside the directory — which paths a rule covers is a question " +
  "this product does not evaluate (§2.3).";

function additionalDirectoryReasonMessage(
  quoted: string,
  entry: string,
): { type: ResolutionReason["type"]; message: string } {
  const kind = classifyAdditionalDirectoryPath(entry);
  const base =
    `${quoted} extends the file access of a session in this project beyond the project root (S11). `;

  if (kind === "absolute") {
    return {
      type: "declared",
      message:
        base +
        "The path is absolute. " +
        ADDITIONAL_DIRECTORY_GUARDRAIL,
    };
  }

  return {
    type: "unknown",
    message:
      `${quoted} is declared in permissions.additionalDirectories (S11). ` +
      "The entry is a relative path and is reported verbatim; §3.5 does not state how relative entries resolve.",
  };
}

/**
 * `permissions.additionalDirectories`, one capability per declared entry (S11).
 *
 * Two layers declaring the key is left undetermined rather than merged: S1
 * orders settings *files*, and §3.5 does not say whether a higher-priority
 * layer replaces a lower one's list or the two lists add up. Reporting a union
 * would be an answer this product does not have.
 */
function buildAdditionalDirectoryCapabilities(
  layers: readonly SettingsLayer[],
  version: string,
): ResolvedCapability[] {
  const declaring = [...layers]
    .sort((left, right) => right.priority - left.priority)
    .filter((layer) => layer.permissions?.additionalDirectories !== undefined);
  const contested = declaring.length > 1;

  return declaring.flatMap((layer) =>
    layer.permissions!.additionalDirectories!.map((entry, index) => {
      const source: SourceInfo = {
        platform: "claude",
        scope: layer.scope,
        path: layer.path,
        fieldPath: `permissions.additionalDirectories[${index}]`,
      };
      const quoted = `permissions.additionalDirectories entry "${entry}"`;
      const uncontested = additionalDirectoryReasonMessage(quoted, entry);
      return gateCapability(
        {
          capabilityId: `settings-additional-directory:${layer.scope}:${entry}`,
          kind: "permission" as const,
          status: contested
            ? ("unknown" as const)
            : uncontested.type === "unknown"
              ? ("unknown" as const)
              : ("available" as const),
          enforcement: contested
            ? ("unknown" as const)
            : uncontested.type === "unknown"
              ? ("unknown" as const)
              : ("enforced" as const),
          sources: [source],
          reasons: [
            contested
              ? reason(
                  "unknown",
                  `${quoted}: more than one settings layer declares additionalDirectories, and ` +
                    "§3.5 does not state whether a higher-priority layer replaces a lower " +
                    "one's list or the lists add up, so which directories this session reaches " +
                    "is not determined.",
                  source,
                  MATRIX["settings.additionalDirectories"],
                )
              : reason(
                  uncontested.type,
                  uncontested.message,
                  source,
                  MATRIX["settings.additionalDirectories"],
                ),
          ],
        },
        MATRIX["settings.additionalDirectories"],
        version,
      );
    }),
  );
}

/**
 * The two S11 settings keys as capabilities: the directories a settings layer
 * adds to the session's file access, and the approval of the project's
 * `.mcp.json` servers.
 */
export function resolveSettingsKeys(
  layers: readonly SettingsLayer[],
  version: string,
): ResolvedCapability[] {
  const approval = resolveProjectMcpApproval(layers);
  return [
    ...buildAdditionalDirectoryCapabilities(layers, version),
    ...(approval ? [buildProjectMcpApprovalCapability(approval, version)] : []),
  ];
}

function reason(
  type: ResolutionReason["type"],
  message: string,
  source: SourceInfo,
  matrixRef?: string,
): ResolutionReason {
  return matrixRef ? { type, message, source, matrixRef } : { type, message, source };
}

/** Bare-name `deny` rules, which S5 says remove the tool from the session. */
function bareToolDenials(rules: readonly IndexedSettingsRule[]): IndexedSettingsRule[] {
  return rules.filter(
    (entry) => entry.rule.action === "deny" && entry.parsed.kind === "bare-tool",
  );
}

/**
 * The bare `deny` rule that removed a tool from the session, if any layer has
 * one (S5). Exported so that the K8 finding about a skill's `allowed-tools`
 * pre-approval asks the same question the S2 branch of `resolveRule` asks —
 * one deny-precedence path, matched on the tool a rule names and on nothing
 * else, rather than a second one that could drift from it.
 */
export function findBareToolDenial(
  layers: readonly SettingsLayer[],
  tool: string,
): IndexedSettingsRule | undefined {
  return bareToolDenials(indexSettingsRules(layers)).find(
    (entry) => (entry.parsed as { tool: string }).tool === tool,
  );
}

interface RuleOutcome {
  status: ResolvedCapability["status"];
  reasons: ResolutionReason[];
  sources: SourceInfo[];
  matrixId: MatrixId;
}

/** SS-04: S6 names prefix matching; which command lines match is §2.3 out of scope. */
const BASH_PREFIX_MATCHING_REFUSAL =
  "Which command lines match the prefix is not evaluated (§2.3).";

/** SS-05: S7 names glob matching; whether a concrete path matches is §2.3 out of scope. */
const PATH_GLOB_MATCHING_REFUSAL =
  "Whether a particular path matches the glob is not evaluated (§2.3).";

function bashPrefixShapeMessage(
  quoted: string,
  shape: BashPrefixShape,
  action: SettingsPermissionAction,
): string {
  const invocationLimit =
    action === "deny"
      ? `${BASH_PREFIX_MATCHING_REFUSAL} What a deny rule in this form leaves of the tool is not determined.`
      : `${BASH_PREFIX_MATCHING_REFUSAL} The effect of this rule on the capability set is not determined.`;

  switch (shape) {
    case "trailing-wildcard":
      return (
        `${quoted} uses Bash prefix matching with a trailing :* wildcard suffix (S6). ` +
        invocationLimit
      );
    case "mid-pattern-colon-star":
      return (
        `${quoted} contains :* away from the end of the pattern; S6 recognizes :* as a ` +
        `wildcard suffix only at the end, so this occurrence is part of the literal prefix ` +
        `(S6). ${invocationLimit}`
      );
    case "literal-prefix":
      return (
        `${quoted} narrows Bash by a literal prefix with no :* wildcard suffix (S6). ` +
        invocationLimit
      );
  }
}

function pathGlobAnchorMessage(
  quoted: string,
  anchor: PathGlobAnchor,
  action: SettingsPermissionAction,
): string {
  const pathMatchLimit =
    action === "deny"
      ? `${PATH_GLOB_MATCHING_REFUSAL} What a deny rule in this form leaves of the tool is not determined.`
      : `${PATH_GLOB_MATCHING_REFUSAL} The effect of this rule on the capability set is not determined.`;

  switch (anchor) {
    case "project-root":
      return (
        `${quoted} uses a path glob anchored at the project root with a leading / (S7). ` +
        pathMatchLimit
      );
    case "absolute":
      return (
        `${quoted} uses a path glob anchored at the filesystem root with a leading // (S7). ` +
        pathMatchLimit
      );
    case "no-leading-slash":
      return (
        `${quoted} uses a path glob without a leading / or //; S7 names anchoring only for ` +
        `those forms, so the glob shape is undetermined.`
      );
  }
}

function resolvePathGlobRule(
  entry: IndexedSettingsRule,
  matrixId: MatrixId,
): RuleOutcome {
  const { parsed, rule, source } = entry;
  const quoted = `permissions.${rule.action} entry "${rule.raw}"`;
  const anchor = classifyPathGlobAnchor((parsed as { argument: string }).argument);
  if (anchor === "no-leading-slash") {
    return {
      status: "unknown",
      reasons: [
        reason(
          "unknown",
          pathGlobAnchorMessage(quoted, anchor, rule.action),
          source,
          matrixId,
        ),
      ],
      sources: [source],
      matrixId,
    };
  }
  return {
    status: "available",
    reasons: [
      reason("declared", pathGlobAnchorMessage(quoted, anchor, rule.action), source, matrixId),
    ],
    sources: [source],
    matrixId,
  };
}

function resolveBashPrefixRule(
  entry: IndexedSettingsRule,
  matrixId: MatrixId,
): RuleOutcome {
  const { parsed, rule, source } = entry;
  const quoted = `permissions.${rule.action} entry "${rule.raw}"`;
  const shape = classifyBashPrefixShape((parsed as { argument: string }).argument);
  return {
    status: "available",
    reasons: [
      reason("declared", bashPrefixShapeMessage(quoted, shape, rule.action), source, matrixId),
    ],
    sources: [source],
    matrixId,
  };
}

/**
 * Resolve one rule.
 *
 * The asymmetry between `allow` and `deny` is deliberate. Where §3.5 says a
 * rule form is invalid, an `allow` in that form is reported as granting
 * nothing — the safe direction, and what S3/S4 state outright. A `deny` in an
 * unsupported form is *not* reported as inert: §3.5 says the syntax is
 * required, not what the platform does with a rule that omits it, and calling
 * a restriction ineffective on that basis would be the §13.14 failure.
 */
function resolveRule(
  entry: IndexedSettingsRule,
  denials: readonly IndexedSettingsRule[],
): RuleOutcome {
  const { parsed, rule, source } = entry;
  const matrixId = ruleMatrixId(parsed, rule.action);
  const quoted = `permissions.${rule.action} entry "${rule.raw}"`;
  const of = (
    status: ResolvedCapability["status"],
    type: ResolutionReason["type"],
    message: string,
    extraSources: SourceInfo[] = [],
    extraReasons: ResolutionReason[] = [],
  ): RuleOutcome => ({
    status,
    reasons: [reason(type, message, source, matrixId), ...extraReasons],
    sources: [source, ...extraSources],
    matrixId,
  });

  if (parsed.kind === "unanchored-glob") {
    return rule.action === "allow"
      ? of(
          "blocked",
          "denied",
          `${quoted} is an unanchored glob and grants nothing (S4).`,
        )
      : of(
          "unknown",
          "unknown",
          `${quoted} is an unanchored glob; S4 covers such globs in allow only, so the effect of this rule is unknown.`,
        );
  }

  if (parsed.kind === "invalid-mcp-bracket") {
    return rule.action === "allow"
      ? of(
          "blocked",
          "denied",
          `${quoted} uses the bracket syntax, which MCP permission rules do not support, so it grants nothing (S3).`,
        )
      : of(
          "unknown",
          "unknown",
          `${quoted} uses the bracket syntax, which is invalid for MCP rules (S3); whether the platform ignores this deny rule or reads it some other way is not determined.`,
        );
  }

  if (parsed.kind === "webfetch-no-domain") {
    return rule.action === "allow"
      ? of(
          "blocked",
          "denied",
          `${quoted} lacks the "domain:" prefix WebFetch rules require, so it grants nothing (S8).`,
        )
      : of(
          "unknown",
          "unknown",
          `${quoted} lacks the "domain:" prefix WebFetch rules require (S8); whether the platform ignores this deny rule or reads it some other way is not determined.`,
        );
  }

  if (parsed.kind === "unrecognized") {
    return of(
      "unknown",
      "unknown",
      `${quoted} is not a rule syntax described in §3.5; its effect is unknown.`,
    );
  }

  if (parsed.kind === "bare-unknown") {
    return of(
      "unknown",
      "unknown",
      `${quoted} names "${parsed.name}", which is not a tool this product knows; its effect is unknown.`,
    );
  }

  if (rule.action === "deny" && parsed.kind === "bare-tool") {
    return of(
      "denied",
      "denied",
      `${quoted} removes the tool from the session entirely (S5); settings deny rules are applied last and are not overridden by agent frontmatter or by a bypass permission mode (S2).`,
    );
  }

  // S2: an allow (or ask) rule that names a tool a deny rule removed cannot
  // put it back, whichever layer either rule came from.
  const tool = ruleTool(parsed);
  const blockedBy = denials.find(
    (denial) => (denial.parsed as { tool: string }).tool === tool,
  );
  if (blockedBy && rule.action !== "deny") {
    return {
      status: "blocked",
      reasons: [
        reason(
          "denied",
          `${quoted} has no effect: a settings layer denies "${blockedBy.rule.raw}", and a deny rule is not overridden at any level (S2, S5). See this reason's source for the deny entry.`,
          blockedBy.source,
          MATRIX["settings.denyPrecedence"],
        ),
      ],
      sources: [source, blockedBy.source],
      matrixId: MATRIX["settings.denyPrecedence"],
    };
  }

  if (rule.action === "ask") {
    return of(
      "unknown",
      "unknown",
      `${quoted} makes the platform prompt for approval; §3.5 does not describe what an ask rule changes in the resolved capability set, so its effect is unknown.`,
    );
  }

  if (parsed.kind === "scoped") {
    if (parsed.tool === "Bash") {
      return resolveBashPrefixRule(entry, matrixId);
    }
    if (parsed.tool === "Read" || parsed.tool === "Edit") {
      return resolvePathGlobRule(entry, matrixId);
    }
    const s6Disclaimer =
      parsed.tool === "PowerShell"
        ? " S6 documents Bash(cmd:*) prefix matching only and does not cover PowerShell, so this rule is not attributed to that fact."
        : "";
    return of(
      "unknown",
      "unknown",
      `${quoted} narrows individual invocations of ${parsed.tool} rather than the tool itself; this product resolves what the platform applies and does not evaluate rule arguments (§2.3), so the effect of this rule is unknown.${s6Disclaimer}`,
    );
  }

  // Bare allow of a tool, or a bracket-free MCP rule of either action.
  return rule.action === "deny"
    ? of(
        "unknown",
        "unknown",
        `${quoted} names an MCP server or tool in the bracket-free form S3 describes; §3.5 does not state what a deny rule in that form leaves of the server, so its effect is unknown. Capabilities it may cover are reported undetermined rather than available.`,
      )
    : of(
        "unknown",
        "unknown",
        `${quoted} pre-approves what it names rather than adding it to the session; §3.5 documents no effect on the resolved capability set, so the effect of this rule is unknown.`,
      );
}

/**
 * Whether a bracket-free MCP rule names a capability. S3 gives three forms:
 * `mcp__server` covers the server and its tools, `mcp__server__tool` one tool,
 * `mcp__server__*` the server's tools.
 */
function mcpRuleCovers(rule: string, capabilityId: string): boolean {
  if (rule.endsWith("__*")) {
    return capabilityId.startsWith(rule.slice(0, -1));
  }
  return capabilityId === rule || capabilityId.startsWith(`${rule}__`);
}

/** S10: `Skill` names every skill, `Skill(<name>)` / `Skill(<name> *)` one. */
function skillRuleCovers(parsed: ParsedRule, capabilityId: string): boolean {
  if (parsed.kind === "bare-tool" && parsed.tool === "Skill") {
    return true;
  }
  if (parsed.kind !== "scoped" || parsed.tool !== "Skill") {
    return false;
  }
  return capabilityId === `skill:${parsed.argument.replace(/\s+\*$/, "").trim()}`;
}

/**
 * A `deny` rule this resolver cannot act on but that plainly names the
 * capability. Leaving such a capability `available` / `preloaded` would be the
 * §6 archetype of a confident wrong answer, so it becomes `unknown` with the
 * rule cited — the deny is not overridden (S2), we simply do not claim to know
 * what survives it.
 */
function unactedDenial(
  entry: IndexedSettingsRule,
  capability: ResolvedCapability,
): { matrixId: MatrixId; message: string } | undefined {
  const { parsed, rule } = entry;
  if (rule.action !== "deny") {
    return undefined;
  }

  if (
    capability.kind === "mcp_tool" &&
    parsed.kind === "mcp" &&
    mcpRuleCovers(parsed.raw, capability.capabilityId)
  ) {
    return {
      matrixId: MATRIX["settings.mcpRuleSyntax"],
      message:
        `A settings layer denies "${rule.raw}", which names this MCP tool (S3), and a deny rule is ` +
        `not overridden at any level (S2); §3.5 does not state what the rule leaves of the tool, ` +
        `so its availability is undetermined rather than available.`,
    };
  }

  if (capability.kind === "skill" && skillRuleCovers(parsed, capability.capabilityId)) {
    return {
      matrixId: MATRIX["settings.denySkills"],
      message:
        `A settings layer denies "${rule.raw}", which names this skill (S10), and a deny rule is ` +
        `not overridden at any level (S2); whether the skill is still preloaded into the agent ` +
        `context is not determined.`,
    };
  }

  return undefined;
}

function ruleCapabilityId(entry: IndexedSettingsRule): string {
  return `settings-permission:${entry.layer.scope}:${entry.rule.action}:${entry.rule.raw}`;
}

function capabilityKind(toolName: string): ResolvedCapability["kind"] {
  return isMcpTool(toolName) ? "mcp_tool" : "tool";
}

export interface ResolveSettingsPermissionsInput {
  layers: readonly SettingsLayer[];
  /** Capabilities resolved so far; settings rules are applied last (§4.4.7). */
  capabilities: readonly ResolvedCapability[];
  version: string;
}

export interface ResolveSettingsPermissionsResult {
  /** Input capabilities with S5/S2 denials applied. */
  capabilities: ResolvedCapability[];
  /** One capability per settings rule, in layer-precedence order. */
  ruleCapabilities: ResolvedCapability[];
}

/**
 * Apply settings permission rules to a resolved capability set.
 * @see docs/SPEC.md §4.4 rule 7, S1, S2, S5
 */
export function resolveSettingsPermissions(
  input: ResolveSettingsPermissionsInput,
): ResolveSettingsPermissionsResult {
  const { layers, version } = input;
  const rules = indexSettingsRules(layers);
  const denials = bareToolDenials(rules);

  const byId = new Map(
    input.capabilities.map((capability) => [capability.capabilityId, capability]),
  );

  for (const denial of denials) {
    const tool = (denial.parsed as { tool: string }).tool;
    const outcome = resolveRule(denial, denials);
    const existing = byId.get(tool);
    // S2: the deny wins over whatever earlier stage produced this capability,
    // including a permitting frontmatter, a fork's inherited pool and a bypass
    // permission mode — so the verdict is rebuilt, not merely appended to.
    byId.set(
      tool,
      gateCapability(
        {
          capabilityId: tool,
          kind: capabilityKind(tool),
          status: "denied" as const,
          enforcement: "enforced" as const,
          sources: [...(existing?.sources ?? []), denial.source],
          reasons: [...(existing?.reasons ?? []), ...outcome.reasons],
        },
        MATRIX["settings.denyBareTool"],
        version,
      ),
    );
  }

  // Deny rules the stage cannot act on, but which name a capability outright.
  for (const entry of rules) {
    for (const [capabilityId, capability] of [...byId]) {
      const denial = unactedDenial(entry, capability);
      if (!denial) {
        continue;
      }
      byId.set(
        capabilityId,
        gateCapability(
          {
            ...capability,
            status: "unknown" as const,
            enforcement: "unknown" as const,
            sources: [...capability.sources, entry.source],
            reasons: [
              ...capability.reasons,
              reason("unknown", denial.message, entry.source, denial.matrixId),
            ],
          },
          denial.matrixId,
          version,
        ),
      );
    }
  }

  const seen = new Set<string>();
  const ruleCapabilities: ResolvedCapability[] = [];
  for (const entry of rules) {
    const capabilityId = ruleCapabilityId(entry);
    if (seen.has(capabilityId)) {
      // The same rule written twice in one layer is one rule.
      continue;
    }
    seen.add(capabilityId);

    const outcome = resolveRule(entry, denials);
    ruleCapabilities.push(
      gateCapability(
        {
          capabilityId,
          kind: "permission" as const,
          status: outcome.status,
          // `enforced` claims the platform applies the rule the way this
          // verdict says — that it removes the tool (S5) or that it grants
          // nothing (S2, S3, S4). The matrix downgrades the claim when the
          // entry behind it is weaker; an undetermined rule starts at the
          // floor and cannot be lifted by the gate.
          enforcement: outcome.status === "unknown" ? "unknown" : "enforced",
          sources: outcome.sources,
          reasons: outcome.reasons,
        },
        outcome.matrixId,
        version,
      ),
    );
  }

  return { capabilities: [...byId.values()], ruleCapabilities };
}
