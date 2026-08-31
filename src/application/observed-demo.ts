/**
 * Dev/demo observed payload loader (S9P-06).
 * Server-only — uses node:fs. UI imports from src/core/observed/session.ts instead.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  collectFromHookEvents,
  validateHookEventRecording,
} from "../adapters/claude/probing/invocation-collector.js";
import {
  OBSERVED_UI_DISCLAIMER,
  type ObservedSessionPayload,
} from "../core/observed/session.js";

export {
  indexObservedCapabilities,
  OBSERVED_UI_DISCLAIMER,
  type ObservedSessionPayload,
} from "../core/observed/session.js";

const DEMO_RECORDING_PATH = path.join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../tests/fixtures/probes/hooks/claude-basic.json",
);

let cachedPayload: ObservedSessionPayload | null | undefined;

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
