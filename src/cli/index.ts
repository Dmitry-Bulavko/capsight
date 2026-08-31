#!/usr/bin/env node
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Command } from "commander";
import type {
  Agent,
  ContextPreset,
  ExecutionContext,
  ResolvedCapability,
} from "../core/model/index.js";
import { parsePlatformId, type PlatformId } from "../adapters/platform.js";
import type { ScanResult } from "../application/scan.js";
import { PERMISSION_MODES, type PermissionMode } from "../adapters/claude/model/index.js";
import { buildExecutionContext } from "../adapters/claude/resolution/context.js";
import {
  CONTEXT_PRESETS,
  DEFAULT_CONTEXT_PRESET,
  DEFAULT_CONTEXT_NOTICE,
  DEFAULT_CONTEXT_REASON,
  invalidContextPresetMessage,
  isContextPreset,
} from "../core/model/context-presets.js";
import {
  collectAgentWarnings,
  type AgentWarning,
} from "../application/collect-warnings.js";
import { resolve } from "../application/resolve.js";
import {
  buildStatusSummary,
  getAgentsFromResult,
  getOrScan,
  scanAndStore,
  type ScanStatusSummary,
} from "../application/scan-store.js";
import { probeMcp } from "../application/probe-mcp.js";
import type { McpProbeResponse } from "../adapters/claude/probing/mcp-probe.js";
import {
  simulateManagedOverlay,
  type ManagedSimulationResult,
} from "../application/simulate.js";
import { plan, type PlanPendingState, type PlanResult } from "../application/plan.js";
import {
  applyConfiguration,
  rollbackConfiguration,
  type ApplyResult,
  type RollbackResult,
} from "../application/apply.js";

export async function runScan(
  projectPath: string,
  platform?: PlatformId,
): Promise<ScanResult> {
  return scanAndStore(projectPath, platform);
}

export async function runStatus(): Promise<ScanStatusSummary> {
  const result = await getOrScan();
  return buildStatusSummary(result);
}

export async function runAgents(): Promise<Agent[]> {
  const result = await getOrScan();
  return getAgentsFromResult(result);
}

/** Re-exported from the single source of truth so both surfaces cannot drift (§4.3). */
export { CONTEXT_PRESETS, DEFAULT_CONTEXT_PRESET, DEFAULT_CONTEXT_REASON };

export interface ContextOptions {
  context?: string;
  depth?: number;
  parentMode?: string;
}

export class InvalidContextPresetError extends Error {
  constructor(preset: string) {
    super(invalidContextPresetMessage(preset));
    this.name = "InvalidContextPresetError";
  }
}

export class InvalidParentModeError extends Error {
  constructor(mode: string) {
    super(`Invalid parentMode: ${mode}. Expected one of: ${PERMISSION_MODES.join(", ")}`);
    this.name = "InvalidParentModeError";
  }
}

/**
 * Resolve the CLI `--context` option into an ExecutionContext.
 * @see docs/SPEC.md §4.3
 */
export function resolveContextOption(options: ContextOptions = {}): {
  context: ExecutionContext;
  /** Present only when `--context` was omitted, so callers can print the §4.3 caption. */
  contextDefault?: { preset: ContextPreset; reason: string };
} {
  const preset = options.context ?? DEFAULT_CONTEXT_PRESET;
  if (!isContextPreset(preset)) {
    throw new InvalidContextPresetError(preset);
  }

  if (
    options.parentMode !== undefined &&
    !PERMISSION_MODES.includes(options.parentMode as PermissionMode)
  ) {
    throw new InvalidParentModeError(options.parentMode);
  }

  const context = buildExecutionContext(preset, {
    ...(options.depth !== undefined ? { depth: options.depth } : {}),
    ...(options.parentMode !== undefined
      ? { parentPermissionMode: options.parentMode as PermissionMode }
      : {}),
  });

  return options.context === undefined
    ? {
        context,
        contextDefault: DEFAULT_CONTEXT_NOTICE,
      }
    : { context };
}

export class CapabilityNotFoundError extends Error {
  constructor(capabilityId: string) {
    super(`Capability not found: ${capabilityId}`);
    this.name = "CapabilityNotFoundError";
  }
}

/** Mirrors `GET /api/capabilities/:id/explain`, plus the §4.3 default caption. */
export interface ExplainResult {
  agentId: string;
  context: ExecutionContext;
  capability: ResolvedCapability;
  contextDefault?: { preset: ContextPreset; reason: string };
}

/**
 * Explain one capability for one agent (read-only). §7.5
 */
export async function runExplain(
  capabilityId: string,
  options: ContextOptions & { agentId: string; projectPath?: string },
): Promise<ExplainResult> {
  const { context, contextDefault } = resolveContextOption(options);
  const scanResult = await getOrScan(options.projectPath);

  const effective = await resolve({
    snapshot: scanResult.snapshot,
    agentId: options.agentId,
    context,
  });

  const capability = effective.capabilities.find(
    (entry) => entry.capabilityId === capabilityId,
  );
  if (!capability) {
    throw new CapabilityNotFoundError(capabilityId);
  }

  return {
    agentId: options.agentId,
    context: effective.context,
    capability,
    ...(contextDefault ? { contextDefault } : {}),
  };
}

/** Mirrors `AgentWarning` from the `/api/warnings` response. */
export type CliAgentWarning = AgentWarning;

/** Mirrors `GET /api/warnings`, plus the §4.3 default caption. */
export interface WarningsResult {
  warnings: CliAgentWarning[];
  contextDefault?: { preset: ContextPreset; reason: string };
}

/**
 * List warnings across active agents (read-only). §7.6
 */
export async function runWarnings(
  options: ContextOptions & { projectPath?: string } = {},
): Promise<WarningsResult> {
  const { context, contextDefault } = resolveContextOption(options);
  const scanResult = await getOrScan(options.projectPath);

  const warnings = await collectAgentWarnings({
    snapshot: scanResult.snapshot,
    context,
  });

  return {
    warnings,
    ...(contextDefault ? { contextDefault } : {}),
  };
}

export async function runProbeMcp(
  serverId: string,
  options: { confirmed?: boolean; projectPath?: string } = {},
): Promise<McpProbeResponse> {
  return probeMcp({
    serverId,
    confirmed: options.confirmed ?? false,
    projectPath: options.projectPath,
  });
}

export async function runSimulateManaged(
  managedBundlePath: string,
  options: { projectPath?: string } = {},
): Promise<ManagedSimulationResult> {
  return simulateManagedOverlay({
    managedBundlePath,
    projectPath: options.projectPath,
  });
}

export async function runDiff(
  options: {
    pending: PlanPendingState;
    editSnapshotId: string;
    projectPath?: string;
  },
): Promise<PlanResult> {
  return plan({
    pending: options.pending,
    editSnapshotId: options.editSnapshotId,
    projectPath: options.projectPath,
  });
}

export async function runApply(
  options: {
    pending: PlanPendingState;
    editSnapshotId: string;
    confirmed: boolean;
    acknowledgeSnapshotChange?: boolean;
    projectPath?: string;
  },
): Promise<ApplyResult> {
  return applyConfiguration({
    pending: options.pending,
    editSnapshotId: options.editSnapshotId,
    confirmed: options.confirmed,
    acknowledgeSnapshotChange: options.acknowledgeSnapshotChange,
    projectPath: options.projectPath,
  });
}

export async function runRollback(
  operationId: string,
  options: { confirmed: boolean; projectPath?: string } = { confirmed: false },
): Promise<RollbackResult> {
  return rollbackConfiguration({
    operationId,
    confirmed: options.confirmed,
    projectPath: options.projectPath,
  });
}

const program = new Command();

program
  .name("agent-manager")
  .description("Claude Agent Configuration Inspector")
  .version("0.0.0");

program
  .command("scan")
  .description("Scan project configuration (read-only)")
  .argument("[path]", "Project path", process.cwd())
  .option("--platform <id>", "Platform adapter (claude | cursor | codex)")
  .action(async (projectPath: string, options: { platform?: string }) => {
    let platform: PlatformId | undefined;
    if (options.platform !== undefined) {
      platform = parsePlatformId(options.platform);
      if (!platform) {
        console.error(`Unknown platform: ${options.platform}`);
        process.exitCode = 1;
        return;
      }
    }
    const result = await runScan(projectPath, platform);
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command("status")
  .description("Show scan status")
  .action(async () => {
    const summary = await runStatus();
    console.log(JSON.stringify(summary, null, 2));
  });

program
  .command("agents")
  .description("List agents from last scan")
  .action(async () => {
    const agents = await runAgents();
    console.log(JSON.stringify(agents, null, 2));
  });

function parseDepthOption(raw: string | undefined): number | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const depth = Number.parseInt(raw, 10);
  if (Number.isNaN(depth)) {
    throw new Error(`Invalid depth: ${raw}`);
  }
  return depth;
}

interface ContextCliOptions {
  context?: string;
  depth?: string;
  parentMode?: string;
  path?: string;
}

program
  .command("explain")
  .description("Explain how a capability resolves for an agent (read-only)")
  .argument("<capability>", "Capability id, e.g. mcp__github__merge_pr")
  .requiredOption("--agent <id>", "Agent id")
  .option(
    "--context <preset>",
    `Execution context preset (${CONTEXT_PRESETS.join(" | ")})`,
  )
  .option("--depth <n>", "Subagent depth override")
  .option("--parent-mode <mode>", "Parent session permission mode override")
  .option("--path <path>", "Project path")
  .action(async (capability: string, options: ContextCliOptions & { agent: string }) => {
    try {
      const result = await runExplain(capability, {
        agentId: options.agent,
        context: options.context,
        depth: parseDepthOption(options.depth),
        parentMode: options.parentMode,
        projectPath: options.path,
      });
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  });

program
  .command("warnings")
  .description("List warnings across active agents (read-only)")
  .option(
    "--context <preset>",
    `Execution context preset (${CONTEXT_PRESETS.join(" | ")})`,
  )
  .option("--depth <n>", "Subagent depth override")
  .option("--parent-mode <mode>", "Parent session permission mode override")
  .option("--path <path>", "Project path")
  .action(async (options: ContextCliOptions) => {
    try {
      const result = await runWarnings({
        context: options.context,
        depth: parseDepthOption(options.depth),
        parentMode: options.parentMode,
        projectPath: options.path,
      });
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  });

program
  .command("probe-mcp")
  .description("Probe an MCP server (requires --yes to run)")
  .argument("<server>", "MCP server name or discovered id")
  .option("--yes", "Confirm and run the probe")
  .option("--path <path>", "Project path")
  .action(async (serverId: string, options: { yes?: boolean; path?: string }) => {
    const result = await runProbeMcp(serverId, {
      confirmed: options.yes ?? false,
      projectPath: options.path,
    });
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command("simulate")
  .description("Simulate managed policy overlay (read-only)")
  .requiredOption("--managed <dir>", "Path to managed policy bundle")
  .option("--path <path>", "Project path")
  .action(async (options: { managed: string; path?: string }) => {
    const result = await runSimulateManaged(options.managed, {
      projectPath: options.path,
    });
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command("diff")
  .description("Show planned file changes from pending editor state (read-only)")
  .requiredOption("--edit-snapshot-id <id>", "Snapshot id when editing started")
  .option("--pending <json>", 'Pending edits JSON, e.g. {"byAgent":{}}', '{"byAgent":{}}')
  .option("--path <path>", "Project path")
  .action(async (options: { editSnapshotId: string; pending: string; path?: string }) => {
    let pending: PlanPendingState;
    try {
      pending = JSON.parse(options.pending) as PlanPendingState;
    } catch {
      console.error("Invalid --pending JSON");
      process.exitCode = 1;
      return;
    }

    if (typeof pending.byAgent !== "object" || pending.byAgent === null) {
      console.error("Pending JSON must include a byAgent object");
      process.exitCode = 1;
      return;
    }

    const result = await runDiff({
      pending,
      editSnapshotId: options.editSnapshotId,
      projectPath: options.path,
    });
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command("apply")
  .description("Apply planned configuration changes (requires --yes)")
  .requiredOption("--edit-snapshot-id <id>", "Snapshot id when editing started")
  .option("--pending <json>", 'Pending edits JSON, e.g. {"byAgent":{}}', '{"byAgent":{}}')
  .option("--yes", "Confirm and apply changes")
  .option(
    "--acknowledge-snapshot-change",
    "Apply even when project configuration changed since editing started",
  )
  .option("--path <path>", "Project path")
  .action(
    async (options: {
      editSnapshotId: string;
      pending: string;
      yes?: boolean;
      acknowledgeSnapshotChange?: boolean;
      path?: string;
    }) => {
      let pending: PlanPendingState;
      try {
        pending = JSON.parse(options.pending) as PlanPendingState;
      } catch {
        console.error("Invalid --pending JSON");
        process.exitCode = 1;
        return;
      }

      if (typeof pending.byAgent !== "object" || pending.byAgent === null) {
        console.error("Pending JSON must include a byAgent object");
        process.exitCode = 1;
        return;
      }

      try {
        const result = await runApply({
          pending,
          editSnapshotId: options.editSnapshotId,
          confirmed: options.yes ?? false,
          acknowledgeSnapshotChange: options.acknowledgeSnapshotChange ?? false,
          projectPath: options.path,
        });
        console.log(JSON.stringify(result, null, 2));
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    },
  );

program
  .command("rollback")
  .description("Restore configuration from a backup (requires --yes)")
  .argument("<operationId>", "Apply operation id to roll back")
  .option("--yes", "Confirm and restore from backup")
  .option("--path <path>", "Project path")
  .action(async (operationId: string, options: { yes?: boolean; path?: string }) => {
    try {
      const result = await runRollback(operationId, {
        confirmed: options.yes ?? false,
        projectPath: options.path,
      });
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  });

const isMainModule =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMainModule) {
  program.parse();
}
