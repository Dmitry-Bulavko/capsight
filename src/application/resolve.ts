import type {
  EffectiveConfiguration,
  ExecutionContext,
  ProjectSnapshot,
} from "../core/model/index.js";

export { AgentNotFoundError, resolveEffectiveConfiguration } from "../adapters/claude/resolution/resolver.js";

export interface ResolveOptions {
  snapshot: ProjectSnapshot;
  agentId: string;
  context: ExecutionContext;
}

/**
 * Public application API for effective configuration resolution.
 * @see docs/SPEC.md §7.3
 */
export async function resolve(options: ResolveOptions): Promise<EffectiveConfiguration> {
  const { getAdapterForSnapshot } = await import("../adapters/registry.js");
  const adapter = getAdapterForSnapshot(options.snapshot);
  return adapter.resolve(options.snapshot, options.agentId, options.context);
}
