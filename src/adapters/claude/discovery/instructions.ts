import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import os from "node:os";
import type { Scope } from "../../../core/model/index.js";
import type { ProjectScopeLevel } from "./project-walk.js";
import type { DiscoveredInstruction } from "./types.js";

const INSTRUCTION_FILES = [
  { file: "CLAUDE.md", type: "CLAUDE.md" as const },
  { file: "CLAUDE.local.md", type: "CLAUDE.local.md" as const },
];

async function fileStat(filePath: string): Promise<{ sizeBytes: number } | null> {
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      return null;
    }
    return { sizeBytes: stat.size };
  } catch {
    return null;
  }
}

function instructionId(filePath: string): string {
  return createHash("sha256").update(`instruction:${filePath}`).digest("hex").slice(0, 16);
}

export async function discoverInstructions(
  projectScopes: ProjectScopeLevel[],
  projectPath: string,
): Promise<DiscoveredInstruction[]> {
  const instructions: DiscoveredInstruction[] = [];
  const resolvedProject = path.resolve(projectPath);

  for (const scope of projectScopes) {
    const scopeType: Scope =
      path.resolve(scope.path) === resolvedProject ? "project" : "nested-project";

    for (const { file, type } of INSTRUCTION_FILES) {
      const filePath = path.join(scope.path, file);
      const stat = await fileStat(filePath);
      if (stat) {
        instructions.push({
          id: instructionId(filePath),
          type,
          path: filePath,
          scope: scopeType,
          sizeBytes: stat.sizeBytes,
        });
      }
    }
  }

  const userClaudeMd = path.join(os.homedir(), ".claude", "CLAUDE.md");
  const userStat = await fileStat(userClaudeMd);
  if (userStat) {
    instructions.push({
      id: instructionId(userClaudeMd),
      type: "CLAUDE.md",
      path: userClaudeMd,
      scope: "user",
      sizeBytes: userStat.sizeBytes,
    });
  }

  return instructions;
}
