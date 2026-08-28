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
  const claudeJsonPath = path.join(os.homedir(), ".claude.json");

  let raw: string;
  try {
    raw = await fs.readFile(claudeJsonPath, "utf8");
  } catch (error) {
    if (isNotFound(error)) {
      return { accepted: false, projectPath: absPath };
    }
    return {
      accepted: "unknown",
      projectPath: absPath,
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
      projectPath: absPath,
      unknownReason: `Could not parse ${claudeJsonPath}: malformed JSON.`,
    };
  }

  if (typeof data !== "object" || data === null) {
    return {
      accepted: "unknown",
      projectPath: absPath,
      unknownReason: `Could not parse ${claudeJsonPath}: unexpected shape.`,
    };
  }

  const projects = data.projects ?? {};
  const entry = projects[absPath] ?? projects[absPath.replace(/\\/g, "/")];
  return {
    accepted: entry?.hasTrustDialogAccepted === true,
    projectPath: absPath,
  };
}
