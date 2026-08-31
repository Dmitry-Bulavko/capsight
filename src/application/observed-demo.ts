/**
 * Dev/demo observed payload bridge (S9P-06).
 * NOT wired to scan — explicit fixture replay only.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  collectFromHookEvents,
  validateHookEventRecording,
} from "../adapters/claude/probing/invocation-collector.js";
import type { ObservedCapability } from "../core/observed/index.js";

export const OBSERVED_UI_DISCLAIMER =
  "Invocation-only observation. Tools are marked observed only when invoked or explicitly denied during a dev observation session. Not observed does not mean denied. Denied status reflects captured denial events (auto-mode only).";

export interface ObservedSessionPayload {
  mode: "dev-demo";
  disclaimer: string;
  sessionAt: string;
  capabilities: ObservedCapability[];
}

const DEMO_RECORDING_PATH = path.join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../tests/fixtures/probes/hooks/claude-basic.json",
);

let cachedPayload: ObservedSessionPayload | null | undefined;

export function indexObservedCapabilities(
  capabilities: readonly ObservedCapability[],
): Map<string, ObservedCapability> {
  const map = new Map<string, ObservedCapability>();
  for (const capability of capabilities) {
    map.set(capability.capabilityId, capability);
  }
  return map;
}

export async function loadObservedDemoPayload(): Promise<ObservedSessionPayload | null> {
  if (cachedPayload !== undefined) {
    return cachedPayload;
  }

  try {
    const raw = JSON.parse(await readFile(DEMO_RECORDING_PATH, "utf8")) as unknown;
    if (!validateHookEventRecording(raw)) {
      cachedPayload = null;
      return null;
    }

    const capabilities = collectFromHookEvents(raw.events, {
      claudeVersion: raw.meta.claudeCodeVersion,
    });

    cachedPayload = {
      mode: "dev-demo",
      disclaimer: OBSERVED_UI_DISCLAIMER,
      sessionAt: raw.meta.recordedAt,
      capabilities,
    };
    return cachedPayload;
  } catch {
    cachedPayload = null;
    return null;
  }
}

export function resetObservedDemoCacheForTests(): void {
  cachedPayload = undefined;
}
