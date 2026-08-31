import type { ObservedCapability } from "./types.js";

/** One-sided observation disclaimer (S9P-UX-CONTRACT). Safe for browser bundle. */
export const OBSERVED_UI_DISCLAIMER =
  "Invocation-only observation. Tools are marked observed only when invoked or explicitly denied during a dev observation session. Not observed does not mean denied. Denied status reflects captured denial events (auto-mode only).";

export interface ObservedSessionPayload {
  mode: "dev-demo";
  disclaimer: string;
  sessionAt: string;
  capabilities: ObservedCapability[];
}

export function indexObservedCapabilities(
  capabilities: readonly ObservedCapability[],
): Map<string, ObservedCapability> {
  const map = new Map<string, ObservedCapability>();
  for (const capability of capabilities) {
    map.set(capability.capabilityId, capability);
  }
  return map;
}
