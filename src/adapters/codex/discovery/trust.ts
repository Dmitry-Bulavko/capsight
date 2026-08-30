import path from "node:path";
import type { TrustState } from "../../../core/model/index.js";
import { FACT } from "../version/facts.js";

const FIXTURE_TRUST_ENV = "CAPSIGHT_CODEX_TRUST_ACCEPTED";

/** @see docs/CODEX-FACTS.md XT1–XT3 */
export async function readTrustState(projectPath: string): Promise<TrustState> {
  const absPath = path.resolve(projectPath);
  const fixtureTrust = process.env[FIXTURE_TRUST_ENV];
  if (fixtureTrust === "true") {
    return { accepted: true, projectPath: absPath };
  }
  if (fixtureTrust === "false") {
    return { accepted: false, projectPath: absPath };
  }
  return {
    accepted: "unknown",
    projectPath: absPath,
    unknownReason: `Codex project trust storage format is not documented (${FACT.XT2}).`,
  };
}

export function shouldSkipProjectCodexLayers(trust: TrustState): boolean {
  return trust.accepted === false;
}
