import path from "node:path";
import type { TrustState } from "../../../core/model/index.js";
import { FACT } from "../version/facts.js";

/** @see docs/CODEX-FACTS.md XT1–XT3 */
export async function readTrustState(projectPath: string): Promise<TrustState> {
  const absPath = path.resolve(projectPath);
  return {
    accepted: "unknown",
    projectPath: absPath,
    unknownReason: `Codex project trust storage format is not documented (${FACT.XT2}).`,
  };
}

export function shouldSkipProjectCodexLayers(trust: TrustState): boolean {
  return trust.accepted === false;
}
