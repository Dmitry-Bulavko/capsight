import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { TrustState } from "../../../core/model/index.js";

interface ClaudeJson {
  projects?: Record<string, { hasTrustDialogAccepted?: boolean }>;
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

function normalizeTrustKey(folderPath: string): string {
  return path.resolve(folderPath);
}

function lookupTrustEntry(
  projects: Record<string, { hasTrustDialogAccepted?: boolean }>,
  folderPath: string,
): boolean | "unknown" {
  const absPath = normalizeTrustKey(folderPath);
  const entry =
    projects[absPath] ?? projects[absPath.replace(/\\/g, "/")];
  return entry?.hasTrustDialogAccepted === true;
}

/**
 * Folder whose trust record gates a project-scoped agent (R1, R5, R2, R6).
 * For `.claude/agents/foo.md` at the scan root this is `"."`; for
 * `nested/.claude/agents/foo.md` it is `nested`.
 */
export function agentTrustFolder(agentPath: string): string {
  const normalized = agentPath.replace(/\\/g, "/");
  const marker = "/.claude/agents/";
  const idx = normalized.indexOf(marker);
  if (idx >= 0) {
    return normalized.slice(0, idx) || ".";
  }
  return ".";
}

export interface TrustRecordResult {
  accepted: boolean | "unknown";
  unknownReason?: string;
}

/**
 * Read the trust record for one folder from `~/.claude.json`.
 */
export async function readTrustRecord(folderPath: string): Promise<TrustRecordResult> {
  const claudeJsonPath = path.join(os.homedir(), ".claude.json");

  let raw: string;
  try {
    raw = await fs.readFile(claudeJsonPath, "utf8");
  } catch (error) {
    if (isNotFound(error)) {
      return { accepted: false };
    }
    return {
      accepted: "unknown",
      unknownReason: `Could not read ${claudeJsonPath}: ${
        (error as NodeJS.ErrnoException).code ?? "read error"
      }.`,
    };
  }

  let data: ClaudeJson;
  try {
    data = JSON.parse(raw) as ClaudeJson;
  } catch {
    return {
      accepted: "unknown",
      unknownReason: `Could not parse ${claudeJsonPath}: malformed JSON.`,
    };
  }

  if (typeof data !== "object" || data === null) {
    return {
      accepted: "unknown",
      unknownReason: `Could not parse ${claudeJsonPath}: unexpected shape.`,
    };
  }

  return { accepted: lookupTrustEntry(data.projects ?? {}, folderPath) };
}

/**
 * Read the project trust record from `~/.claude.json`.
 *
 * A missing file means no trust record exists, which is an honest `false`.
 * Any other failure (permission error, malformed JSON) leaves the trust state
 * genuinely undetermined and is reported as `"unknown"` rather than a denial.
 *
 * @see docs/SPEC.md §13 invariants 3, 4
 */
export async function readTrustState(projectPath: string): Promise<TrustState> {
  const absPath = path.resolve(projectPath);
  const record = await readTrustRecord(absPath);
  return {
    accepted: record.accepted,
    projectPath: absPath,
    ...(record.unknownReason ? { unknownReason: record.unknownReason } : {}),
  };
}

export interface BuildTrustStateInput {
  projectPath: string;
  repoRoot?: string;
  /** Repo-relative folders that may gate agents (R2, R6). */
  folderPaths?: readonly string[];
  /** Project-relative `--add-dir` paths (R6). */
  addDirs?: readonly string[];
}

function trustFolderKey(folderPath: string): string {
  const abs = path.resolve(folderPath);
  return abs.replace(/\\/g, "/");
}

/**
 * Build trust for the scan root and any nested or `--add-dir` folders that
 * carry project-scoped agents.
 */
export async function buildTrustState(input: BuildTrustStateInput): Promise<TrustState> {
  const absProject = path.resolve(input.projectPath);
  const absRepo = path.resolve(input.repoRoot ?? input.projectPath);

  const folders = new Set<string>([absProject, absRepo]);
  for (const folder of input.folderPaths ?? []) {
    folders.add(path.resolve(absRepo, folder));
  }
  for (const addDir of input.addDirs ?? []) {
    folders.add(path.resolve(absProject, addDir));
  }

  const folderRecords: Record<string, boolean | "unknown"> = {};
  let projectAccepted: boolean | "unknown" = false;
  let unknownReason: string | undefined;

  for (const folder of folders) {
    const record = await readTrustRecord(folder);
    const accepted =
      record.accepted === "unknown" ? "unknown" : record.accepted;
    folderRecords[trustFolderKey(folder)] = accepted;
    if (folder === absProject) {
      projectAccepted = accepted;
      unknownReason = record.unknownReason;
    }
  }

  return {
    accepted: projectAccepted,
    projectPath: absProject,
    repoRoot: absRepo,
    ...(unknownReason ? { unknownReason } : {}),
    ...(Object.keys(folderRecords).length > 0 ? { folderRecords } : {}),
  };
}
