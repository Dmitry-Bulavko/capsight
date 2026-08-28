import fs from "node:fs/promises";
import path from "node:path";
import {
  backupDirForOperation,
  readBackupManifest,
  type BackupManifest,
} from "./apply.js";

export class BackupNotFoundError extends Error {
  constructor(operationId: string) {
    super(`Backup not found for operation: ${operationId}`);
    this.name = "BackupNotFoundError";
  }
}

export interface RestoreBackupInput {
  projectPath: string;
  operationId: string;
}

export interface RestoreBackupResult {
  operationId: string;
  restoredFiles: string[];
  verified: boolean;
  manifest: BackupManifest;
}

async function backupExists(projectPath: string, operationId: string): Promise<boolean> {
  try {
    await fs.access(path.join(backupDirForOperation(projectPath, operationId), "manifest.json"));
    return true;
  } catch {
    return false;
  }
}

export async function restoreFromBackup(
  input: RestoreBackupInput,
): Promise<RestoreBackupResult> {
  if (!(await backupExists(input.projectPath, input.operationId))) {
    throw new BackupNotFoundError(input.operationId);
  }

  const manifest = await readBackupManifest(input.projectPath, input.operationId);
  const filesDir = path.join(backupDirForOperation(input.projectPath, input.operationId), "files");
  const restoredFiles: string[] = [];

  for (const entry of manifest.files) {
    const backupFilePath = path.join(filesDir, entry.relativePath);
    await fs.mkdir(path.dirname(entry.path), { recursive: true });
    await fs.copyFile(backupFilePath, entry.path);
    restoredFiles.push(entry.path);
  }

  restoredFiles.sort((left, right) => left.localeCompare(right));

  let verified = restoredFiles.length > 0;
  for (const entry of manifest.files) {
    const backupFilePath = path.join(filesDir, entry.relativePath);
    const [backupContent, restoredContent] = await Promise.all([
      fs.readFile(backupFilePath, "utf8"),
      fs.readFile(entry.path, "utf8"),
    ]);
    if (backupContent !== restoredContent) {
      verified = false;
      break;
    }
  }

  return {
    operationId: input.operationId,
    restoredFiles,
    verified,
    manifest,
  };
}
