import path from "node:path";
import type { TrustState } from "../../../core/model/index.js";
import { FACT } from "../version/facts.js";

/** @see docs/CURSOR-FACTS.md CT1 */
export async function readTrustState(projectPath: string): Promise<TrustState> {
  const absPath = path.resolve(projectPath);
  return {
    accepted: "unknown",
    projectPath: absPath,
    unknownReason: `Cursor project trust model is not documented (${FACT.CT1}).`,
  };
}
