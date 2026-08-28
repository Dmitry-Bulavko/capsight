import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { TrustState } from "../../../core/model/index.js";

interface ClaudeJson {
  projects?: Record<string, { hasTrustDialogAccepted?: boolean }>;
}

export async function readTrustState(projectPath: string): Promise<TrustState> {
  const absPath = path.resolve(projectPath);
  const claudeJsonPath = path.join(os.homedir(), ".claude.json");

  try {
    const raw = await fs.readFile(claudeJsonPath, "utf8");
    const data = JSON.parse(raw) as ClaudeJson;
    const projects = data.projects ?? {};
    const entry = projects[absPath] ?? projects[absPath.replace(/\\/g, "/")];
    return {
      accepted: entry?.hasTrustDialogAccepted === true,
      projectPath: absPath,
    };
  } catch {
    return {
      accepted: false,
      projectPath: absPath,
    };
  }
}
