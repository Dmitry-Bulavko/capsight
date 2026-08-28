/**
 * Claude-specific domain types: agent frontmatter fields, permission modes and
 * builtin agent kinds. Core stays free of these names (§12.2, §13 invariant 1).
 * @see docs/SPEC.md §5, §12.2
 */

import type {
  Agent,
  AgentConfiguration,
  ProjectSnapshot,
  UnknownFieldType,
} from "../../../core/model/index.js";

/** Platform identifier written into every SourceInfo/PlatformVersion. */
export const CLAUDE_PLATFORM = "claude" as const;

/** @see docs/SPEC.md §3.4 */
export type PermissionMode =
  | "default"
  | "acceptEdits"
  | "auto"
  | "dontAsk"
  | "bypassPermissions"
  | "plan";

export const PERMISSION_MODES: readonly PermissionMode[] = [
  "default",
  "acceptEdits",
  "auto",
  "dontAsk",
  "bypassPermissions",
  "plan",
];

/** Builtin agent kinds (§3.6). */
export type BuiltinAgentKind = "explore" | "plan" | "general-purpose" | "claude";

/**
 * Redacted inline MCP definition from agent configuration.
 * Key names only — never values (§0.1.8, §13 invariant 10).
 */
export interface RedactedMcpServer {
  name?: string;
  transport: "stdio" | "sse" | "http" | "ws" | "unknown";
  /** Executable name only, without arguments. */
  commandName?: string;
  envKeys: string[];
  headerKeys: string[];
}

/**
 * Structural summary of declared hooks.
 * Event names and counts only — never command strings or arguments.
 */
export interface HooksSummary {
  form: "object" | "array" | "scalar";
  events: string[];
  count: number;
}

/** Literal transcription of Claude agent frontmatter (§8.2). */
export interface ClaudeAgentConfiguration extends AgentConfiguration {
  tools?: string[];
  disallowedTools?: string[];
  mcpServers?: Array<string | RedactedMcpServer>;
  model?: string;
  permissionMode?: PermissionMode;
  maxTurns?: number;
  skills?: string[];
  hooks?: HooksSummary;
  memory?: "user" | "project" | "local";
  background?: boolean;
  effort?: string;
  isolation?: "worktree";
  initialPrompt?: string;
  color?: string;
  /** Unrecognized frontmatter keys mapped to value types (§8.2) — never values. */
  unknownFields: Record<string, UnknownFieldType>;
}

export type ClaudeAgent = Agent<ClaudeAgentConfiguration>;

export type ClaudeProjectSnapshot = ProjectSnapshot<ClaudeAgentConfiguration>;
