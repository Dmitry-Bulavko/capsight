import type { ProjectSnapshot } from "../core/model/index.js";
import {
  computeAgentToolFrontmatter,
  diffToolFrontmatter,
} from "../adapters/claude/generation/plan.js";
import { assertClaudePlatform } from "./platform-guard.js";
import { getOrScan } from "./scan-store.js";

export interface PlanPendingState {
  /** agentId → toolName → desired enabled state */
  byAgent: Record<string, Record<string, boolean>>;
}

export interface PlanFieldChange {
  field: "tools" | "disallowedTools";
  before?: string[];
  after?: string[];
}

export interface PlanFileChange {
  path: string;
  agentId: string;
  agentName: string;
  changes: PlanFieldChange[];
}

export interface PlanWarning {
  code: "snapshot-id-changed";
  message: string;
  editSnapshotId: string;
  currentSnapshotId: string;
}

export interface PlanResult {
  snapshotId: string;
  editSnapshotId: string;
  files: PlanFileChange[];
  warnings: PlanWarning[];
}

export interface PlanOptions {
  pending: PlanPendingState;
  editSnapshotId: string;
  snapshot?: ProjectSnapshot;
  projectPath?: string;
}

export async function plan(options: PlanOptions): Promise<PlanResult> {
  const scanResult = options.snapshot
    ? { snapshot: options.snapshot, status: "complete" as const }
    : await getOrScan(options.projectPath ?? process.cwd());

  const snapshot = scanResult.snapshot;
  assertClaudePlatform(snapshot, "Configuration planning");
  const warnings: PlanWarning[] = [];

  if (options.editSnapshotId !== snapshot.id) {
    warnings.push({
      code: "snapshot-id-changed",
      message:
        "Project configuration changed since editing started. Review the diff before applying.",
      editSnapshotId: options.editSnapshotId,
      currentSnapshotId: snapshot.id,
    });
  }

  const agentsById = new Map(snapshot.agents.map((agent) => [agent.id, agent]));
  const files: PlanFileChange[] = [];
  const agentIds = Object.keys(options.pending.byAgent).sort((left, right) =>
    left.localeCompare(right),
  );

  for (const agentId of agentIds) {
    const pendingEdits = options.pending.byAgent[agentId];
    if (!pendingEdits || Object.keys(pendingEdits).length === 0) {
      continue;
    }

    const agent = agentsById.get(agentId);
    if (!agent?.source.path) {
      continue;
    }

    const nextFrontmatter = computeAgentToolFrontmatter(agent, pendingEdits);
    const fieldChanges = diffToolFrontmatter(agent.configuration, nextFrontmatter);
    if (fieldChanges.length === 0) {
      continue;
    }

    files.push({
      path: agent.source.path,
      agentId: agent.id,
      agentName: agent.name,
      changes: fieldChanges,
    });
  }

  files.sort((left, right) => left.path.localeCompare(right.path));

  return {
    snapshotId: snapshot.id,
    editSnapshotId: options.editSnapshotId,
    files,
    warnings,
  };
}
