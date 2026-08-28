import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { stringify as stringifyYaml } from "yaml";
import type { PlatformVersion } from "../../../core/model/index.js";
import { parseFrontmatter } from "../parsing/frontmatter.js";
import type { ToolFrontmatterField } from "./plan.js";

export interface FrontmatterFieldApply {
  field: ToolFrontmatterField;
  after?: string[];
}

export class FrontmatterApplyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FrontmatterApplyError";
  }
}

export function applyFrontmatterFieldChanges(
  content: string,
  changes: FrontmatterFieldApply[],
): string {
  const parsed = parseFrontmatter(content);
  if (!parsed.ok) {
    throw new FrontmatterApplyError(parsed.message);
  }

  const data = { ...parsed.data };
  for (const change of changes) {
    if (change.after === undefined || change.after.length === 0) {
      delete data[change.field];
    } else {
      data[change.field] = change.after;
    }
  }

  const yamlBody = stringifyYaml(data).trimEnd();
  const body = parsed.body;
  if (body.length > 0) {
    return `---\n${yamlBody}\n---\n\n${body}`;
  }
  return `---\n${yamlBody}\n---\n`;
}

export interface BackupFileEntry {
  path: string;
  relativePath: string;
}

export interface BackupManifest {
  operationId: string;
  snapshotId: string;
  claudeVersion: PlatformVersion;
  createdAt: string;
  files: BackupFileEntry[];
}

export interface CreateBackupInput {
  projectPath: string;
  snapshotId: string;
  claudeVersion: PlatformVersion;
  filePaths: string[];
  operationId?: string;
}

export interface CreateBackupResult {
  operationId: string;
  backupDir: string;
  manifest: BackupManifest;
}

export function agentManagerBackupsDir(projectPath: string): string {
  return path.join(projectPath, ".agent-manager", "backups");
}

export function backupDirForOperation(projectPath: string, operationId: string): string {
  return path.join(agentManagerBackupsDir(projectPath), operationId);
}

export async function createBackup(input: CreateBackupInput): Promise<CreateBackupResult> {
  const operationId = input.operationId ?? randomUUID();
  const backupDir = backupDirForOperation(input.projectPath, operationId);
  const filesDir = path.join(backupDir, "files");
  await fs.mkdir(filesDir, { recursive: true });

  const files: BackupFileEntry[] = [];
  for (const filePath of [...input.filePaths].sort((left, right) => left.localeCompare(right))) {
    const relativePath = path.relative(input.projectPath, filePath);
    const backupFilePath = path.join(filesDir, relativePath);
    await fs.mkdir(path.dirname(backupFilePath), { recursive: true });
    await fs.copyFile(filePath, backupFilePath);
    files.push({ path: filePath, relativePath });
  }

  const manifest: BackupManifest = {
    operationId,
    snapshotId: input.snapshotId,
    claudeVersion: input.claudeVersion,
    createdAt: new Date().toISOString(),
    files,
  };

  await fs.writeFile(path.join(backupDir, "manifest.json"), JSON.stringify(manifest, null, 2));

  return { operationId, backupDir, manifest };
}

export interface ApplyFileChangeInput {
  filePath: string;
  changes: FrontmatterFieldApply[];
}

export async function applyFileChanges(changes: ApplyFileChangeInput[]): Promise<void> {
  for (const fileChange of changes) {
    const original = await fs.readFile(fileChange.filePath, "utf8");
    const updated = applyFrontmatterFieldChanges(original, fileChange.changes);
    await fs.writeFile(fileChange.filePath, updated, "utf8");
  }
}

export async function readBackupManifest(
  projectPath: string,
  operationId: string,
): Promise<BackupManifest> {
  const manifestPath = path.join(backupDirForOperation(projectPath, operationId), "manifest.json");
  const raw = await fs.readFile(manifestPath, "utf8");
  return JSON.parse(raw) as BackupManifest;
}
