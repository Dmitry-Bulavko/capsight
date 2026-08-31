/**
 * Dev-only observe CLI (SPEC §9.4, §12.5).
 * NOT wired to scan.
 */

import path from "node:path";
import { probeAgentSdkToolPool } from "../../adapters/claude/probing/agent-sdk-spike.js";
import type { AgentSdkProbeResult } from "../../adapters/claude/probing/agent-sdk-probe-schema.js";
import type { ObservedCapability } from "../../core/observed/index.js";

const OBSERVE_FIXTURE_MARKER = "/tests/fixtures/claude/";

export const OBSERVE_DISCLAIMER =
  "Invocation-only observation (dev-only). Probe fragments are observations, not configuration facts. Not observed does not mean denied.";

export class InvalidObserveFixtureError extends Error {
  constructor(fixturePath: string) {
    super(
      `Observe is dev-only: --fixture must resolve under tests/fixtures/claude/ (got ${fixturePath})`,
    );
    this.name = "InvalidObserveFixtureError";
  }
}

/**
 * Validate that the fixture path resolves under tests/fixtures/claude/.
 * Rejects user project paths and other corpus roots (SPEC §9.4).
 */
export function validateObserveFixturePath(fixturePath: string): string {
  const resolved = path.resolve(fixturePath);
  const normalized = resolved.replace(/\\/g, "/");
  if (
    !normalized.includes(OBSERVE_FIXTURE_MARKER) &&
    !normalized.endsWith("/tests/fixtures/claude")
  ) {
    throw new InvalidObserveFixtureError(fixturePath);
  }
  return resolved;
}

export interface ObserveResult {
  mode: "dev-only";
  fixturePath: string;
  disclaimer: string;
  /** Invocation-only ObservedCapability records (S9P-03). Populated by S9P-05 collector. */
  capabilities: ObservedCapability[];
  /** Agent SDK structural probe — fragment introspection tagged as observation evidence. */
  agentSdkProbe: AgentSdkProbeResult;
}

/**
 * Run dev-only observation probes on a Claude fixture project.
 * Explicit developer command only — never invoked from scan.
 */
export async function runObserve(fixturePath: string): Promise<ObserveResult> {
  const resolved = validateObserveFixturePath(fixturePath);
  const agentSdkProbe = await probeAgentSdkToolPool(resolved);
  return {
    mode: "dev-only",
    fixturePath: resolved,
    disclaimer: OBSERVE_DISCLAIMER,
    capabilities: [],
    agentSdkProbe,
  };
}
