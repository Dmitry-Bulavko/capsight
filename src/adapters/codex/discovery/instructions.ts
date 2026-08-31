import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import type { Scope } from "../../../core/model/index.js";
import { parseToml, getTomlStringArray } from "../parsing/toml.js";
import { gateCapability, MATRIX } from "../version/matrix.js";
import { codexHomeDir, readConfigFile, userConfigPath } from "./paths.js";
import type { ProjectScopeLevel, WalkProjectScopesResult } from "./project-walk.js";
import { scopesRootToCwd } from "./project-walk.js";
import type { DiscoveredInstruction } from "./types.js";

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

/** @see docs/CODEX-FACTS.md XI3 */
export async function loadFallbackFilenames(): Promise<string[]> {
  const raw = await readConfigFile(userConfigPath());
  if (!raw) {
    return [];
  }
  const parsed = parseToml(raw);
  return getTomlStringArray(parsed, "project_doc_fallback_filenames") ?? [];
}

async function addInstruction(
  instructions: DiscoveredInstruction[],
  seen: Set<string>,
  filePath: string,
  type: DiscoveredInstruction["type"],
  scope: Scope,
): Promise<void> {
  const key = filePath;
  if (seen.has(key)) {
    return;
  }
  const stat = await fileStat(filePath);
  if (!stat) {
    return;
  }
  seen.add(key);
  instructions.push({
    id: instructionId(filePath),
    type,
    path: filePath,
    scope,
    sizeBytes: stat.sizeBytes,
  });
}

async function discoverGlobalInstructions(
  instructions: DiscoveredInstruction[],
  seen: Set<string>,
): Promise<void> {
  const home = codexHomeDir();
  const overridePath = path.join(home, "AGENTS.override.md");
  const agentsPath = path.join(home, "AGENTS.md");

  if (await fileStat(overridePath)) {
    await addInstruction(instructions, seen, overridePath, "AGENTS.override.md", "user");
    return;
  }
  await addInstruction(instructions, seen, agentsPath, "AGENTS.md", "user");
}

/** @see docs/CODEX-FACTS.md XI1–XI5 */
export async function discoverInstructions(
  walk: WalkProjectScopesResult,
  version: string,
): Promise<DiscoveredInstruction[]> {
  const instructions: DiscoveredInstruction[] = [];
  const seen = new Set<string>();
  const resolvedProject = path.resolve(walk.projectPath);
  const fallbackGate = gateCapability(MATRIX["instruction.fallback"], version);
  const fallbackNames = fallbackGate.unfounded ? [] : await loadFallbackFilenames();

  await discoverGlobalInstructions(instructions, seen);

  for (const scope of scopesRootToCwd(walk)) {
    const scopeType: Scope =
      path.resolve(scope.path) === resolvedProject ? "project" : "nested-project";

    if (scope.agentsOverridePath) {
      await addInstruction(
        instructions,
        seen,
        scope.agentsOverridePath,
        "AGENTS.override.md",
        scopeType,
      );
      continue;
    }

    if (scope.agentsMdPath) {
      await addInstruction(instructions, seen, scope.agentsMdPath, "AGENTS.md", scopeType);
    }

    for (const fallbackName of fallbackNames) {
      const fallbackPath = path.join(scope.path, fallbackName);
      await addInstruction(instructions, seen, fallbackPath, "fallback", scopeType);
    }
  }

  return instructions;
}
