#!/usr/bin/env node
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Command } from "commander";
import type { Agent } from "../core/model/index.js";
import type { ScanResult } from "../application/scan.js";
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

export async function runScan(projectPath: string): Promise<ScanResult> {
  return scanAndStore(projectPath);
}

export async function runStatus(): Promise<ScanStatusSummary> {
  const result = await getOrScan();
  return buildStatusSummary(result);
}

export async function runAgents(): Promise<Agent[]> {
  const result = await getOrScan();
  return getAgentsFromResult(result);
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
  .action(async (projectPath: string) => {
    const result = await runScan(projectPath);
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

program
  .command("probe-mcp")
  .description("Probe an MCP server (requires --yes to run)")
  .argument("<server>", "MCP server id")
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
