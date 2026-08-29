import fs from "node:fs/promises";
import path from "node:path";
import {
  applyFileChanges,
  createBackup,
  type BackupManifest,
} from "../adapters/claude/generation/apply.js";
import { restoreFromBackup } from "../adapters/claude/generation/rollback.js";
import {
  plan,
  type PlanFileChange,
  type PlanPendingState,
  type PlanResult,
  type PlanWarning,
} from "./plan.js";
import {
  checkLocalStateNotice,
  markLocalStateNoticeDelivered,
  type LocalStateWarning,
} from "./local-state-notice.js";
import { getOrScan, scanAndStore } from "./scan-store.js";
import { assertClaudePlatform } from "./platform-guard.js";
import type { ProjectSnapshot } from "../core/model/index.js";

export const APPLY_SUCCESS_MESSAGE =
  "Configuration written. Runtime behavior has not been independently verified";

export class ApplyNotConfirmedError extends Error {
  constructor() {
    super("Apply requires confirmed: true");
    this.name = "ApplyNotConfirmedError";
  }
}

export class RollbackNotConfirmedError extends Error {
  constructor() {
    super("Rollback requires confirmed: true");
    this.name = "RollbackNotConfirmedError";
  }
}

export class SnapshotChangedError extends Error {
  readonly warnings: PlanWarning[];
  readonly plan: PlanResult;

  constructor(plan: PlanResult) {
    super(
      "Project configuration changed since editing started. Set acknowledgeSnapshotChange: true to apply anyway.",
    );
    this.name = "SnapshotChangedError";
    this.warnings = plan.warnings;
    this.plan = plan;
  }
}

export class ApplyOperationNotFoundError extends Error {
  constructor(operationId: string) {
    super(`Apply operation not found: ${operationId}`);
    this.name = "ApplyOperationNotFoundError";
  }
}

export interface HistoryEntry {
  operationId: string;
  type: "apply" | "rollback";
  timestamp: string;
  snapshotId: string;
  claudeVersion: string;
  files: string[];
  message?: string;
  rolledBack?: boolean;
  rolledBackBy?: string;
  rollbackOf?: string;
}

export interface ApplyOptions {
  pending: PlanPendingState;
  editSnapshotId: string;
  confirmed: boolean;
  acknowledgeSnapshotChange?: boolean;
  projectPath?: string;
  snapshot?: ProjectSnapshot;
}

export interface ApplyResult {
  operationId: string;
  message: string;
  files: PlanFileChange[];
  warnings: PlanWarning[];
  snapshotId: string;
  /** Present only on the first write into the project's `.agent-manager/` (§12.3). */
  localStateWarning?: LocalStateWarning;
}

export interface RollbackOptions {
  operationId: string;
  confirmed: boolean;
  projectPath?: string;
}

export interface RollbackResult {
  operationId: string;
  rollbackOperationId: string;
  message: string;
  restoredFiles: string[];
  verified: boolean;
  localStateWarning?: LocalStateWarning;
}

function agentManagerDir(projectPath: string): string {
  return path.join(projectPath, ".agent-manager");
}

function historyFilePath(projectPath: string): string {
  return path.join(agentManagerDir(projectPath), "history", "operations.json");
}

async function readHistory(projectPath: string): Promise<HistoryEntry[]> {
  try {
    const raw = await fs.readFile(historyFilePath(projectPath), "utf8");
    const parsed = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function appendHistoryEntry(projectPath: string, entry: HistoryEntry): Promise<void> {
  const historyPath = historyFilePath(projectPath);
  await fs.mkdir(path.dirname(historyPath), { recursive: true });
  const history = await readHistory(projectPath);
  history.push(entry);
  await fs.writeFile(historyPath, JSON.stringify(history, null, 2));
}

async function markApplyRolledBack(
  projectPath: string,
  operationId: string,
  rollbackOperationId: string,
): Promise<void> {
  const history = await readHistory(projectPath);
  const applyEntry = history.find(
    (entry) => entry.operationId === operationId && entry.type === "apply",
  );
  if (applyEntry) {
    applyEntry.rolledBack = true;
    applyEntry.rolledBackBy = rollbackOperationId;
    await fs.writeFile(historyFilePath(projectPath), JSON.stringify(history, null, 2));
  }
}

export async function getHistory(projectPath?: string): Promise<HistoryEntry[]> {
  const scanResult = await getOrScan(projectPath ?? process.cwd());
  const history = await readHistory(scanResult.snapshot.projectPath);
  return [...history].sort((left, right) => right.timestamp.localeCompare(left.timestamp));
}

export async function applyConfiguration(options: ApplyOptions): Promise<ApplyResult> {
  if (!options.confirmed) {
    throw new ApplyNotConfirmedError();
  }

  const planResult = await plan({
    pending: options.pending,
    editSnapshotId: options.editSnapshotId,
    snapshot: options.snapshot,
    projectPath: options.projectPath,
  });

  const snapshotChanged = planResult.warnings.some((warning) => warning.code === "snapshot-id-changed");
  if (snapshotChanged && !options.acknowledgeSnapshotChange) {
    throw new SnapshotChangedError(planResult);
  }

  const scanResult = options.snapshot
    ? { snapshot: options.snapshot, status: "complete" as const }
    : await getOrScan(options.projectPath ?? process.cwd());
  const projectPath = scanResult.snapshot.projectPath;

  if (planResult.files.length === 0) {
    return {
      operationId: "",
      message: "No configuration changes to apply.",
      files: [],
      warnings: planResult.warnings,
      snapshotId: planResult.snapshotId,
    };
  }

  const filePaths = planResult.files.map((file) => file.path);
  // Checked before the backup because the backup is what creates the directory.
  const localStateNotice = await checkLocalStateNotice(projectPath);
  const backup: { operationId: string; manifest: BackupManifest } = await createBackup({
    projectPath,
    snapshotId: planResult.snapshotId,
    claudeVersion: scanResult.snapshot.version,
    filePaths,
  });

  try {
    await applyFileChanges(
      planResult.files.map((file) => ({
        filePath: file.path,
        changes: file.changes.map((change) => ({
          field: change.field,
          after: change.after,
        })),
      })),
    );
  } catch (error) {
    await restoreFromBackup({ projectPath, operationId: backup.operationId });
    throw error;
  }

  await appendHistoryEntry(projectPath, {
    operationId: backup.operationId,
    type: "apply",
    timestamp: new Date().toISOString(),
    snapshotId: planResult.snapshotId,
    claudeVersion: scanResult.snapshot.version.version,
    files: filePaths,
    message: APPLY_SUCCESS_MESSAGE,
  });

  if (localStateNotice) {
    markLocalStateNoticeDelivered(projectPath);
  }

  await scanAndStore(projectPath);

  return {
    operationId: backup.operationId,
    message: APPLY_SUCCESS_MESSAGE,
    files: planResult.files,
    warnings: planResult.warnings,
    snapshotId: planResult.snapshotId,
    ...(localStateNotice ? { localStateWarning: localStateNotice } : {}),
  };
}

export async function rollbackConfiguration(options: RollbackOptions): Promise<RollbackResult> {
  if (!options.confirmed) {
    throw new RollbackNotConfirmedError();
  }

  const scanResult = await getOrScan(options.projectPath ?? process.cwd());
  const projectPath = scanResult.snapshot.projectPath;
  const history = await readHistory(projectPath);
  const applyEntry = history.find(
    (entry) => entry.operationId === options.operationId && entry.type === "apply",
  );
  if (!applyEntry) {
    throw new ApplyOperationNotFoundError(options.operationId);
  }

  const restoreResult = await restoreFromBackup({
    projectPath,
    operationId: options.operationId,
  });

  const rollbackOperationId = `rollback-${options.operationId}`;
  const localStateNotice = await checkLocalStateNotice(projectPath);
  await appendHistoryEntry(projectPath, {
    operationId: rollbackOperationId,
    type: "rollback",
    timestamp: new Date().toISOString(),
    snapshotId: restoreResult.manifest.snapshotId,
    claudeVersion: restoreResult.manifest.claudeVersion.version,
    files: restoreResult.restoredFiles,
    rollbackOf: options.operationId,
    message: restoreResult.verified
      ? "Configuration restored from backup."
      : "Configuration restore completed but verification failed.",
  });

  if (localStateNotice) {
    markLocalStateNoticeDelivered(projectPath);
  }

  await markApplyRolledBack(projectPath, options.operationId, rollbackOperationId);
  await scanAndStore(projectPath);

  return {
    operationId: options.operationId,
    rollbackOperationId,
    message: restoreResult.verified
      ? "Configuration restored from backup."
      : "Configuration restore completed but verification failed.",
    restoredFiles: restoreResult.restoredFiles,
    verified: restoreResult.verified,
    ...(localStateNotice ? { localStateWarning: localStateNotice } : {}),
  };
}
