/**
 * Platform tool tables consumed by the core resolver engine.
 *
 * Core never knows any tool name: every table below is supplied as data by a
 * platform adapter (§12.2, §13 invariant 1).
 */
export interface PlatformToolTables {
  /**
   * Spawn tool names. All entries are aliases of the same tool; the first one
   * is the canonical name.
   */
  agentToolNames: readonly string[];
  /** Removed from every subagent by filter 1. */
  filter1RemovedTools: readonly string[];
  /** Exempt from filter 1 while the context is in plan mode. */
  filter1PlanModeExemptTools: readonly string[];
  /** `ExecutionContext.builtinKind` value that denotes plan mode. */
  planModeBuiltinKind: string;
  /** Builtin tools that survive filter 2 for background subagents. */
  filter2AllowedBuiltinTools: readonly string[];
  /** Extra tools filter 2 additionally keeps for teammates. */
  filter2TeammateAdditionalTools: readonly string[];
  /**
   * Namespaced tools provided by an external server. Filter 2 always keeps
   * them, and the graph links them to their owning server.
   */
  isNamespacedTool(toolName: string): boolean;
  /** Owning server id of a namespaced tool, or `undefined` when there is none. */
  namespacedToolOwner(toolName: string): string | undefined;
}
