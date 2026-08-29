/**
 * Platform adapter registry.
 * @see docs/SPEC.md §12.2
 */

import type { ProjectSnapshot } from "../core/model/index.js";
import { claudeAdapter } from "./claude/adapter.js";
import { codexAdapter } from "./codex/adapter.js";
import { cursorAdapter } from "./cursor/adapter.js";
import {
  DEFAULT_PLATFORM_ID,
  type PlatformAdapter,
  type PlatformId,
  UnknownPlatformError,
  isPlatformId,
} from "./platform.js";

export {
  DEFAULT_PLATFORM_ID,
  PLATFORM_IDS,
  PlatformNotImplementedError,
  UnknownPlatformError,
  isPlatformId,
  parsePlatformId,
  type AdapterScanOptions,
  type AdapterScanResult,
  type PlatformAdapter,
  type PlatformId,
} from "./platform.js";

const ADAPTERS: Record<PlatformId, PlatformAdapter> = {
  claude: claudeAdapter,
  cursor: cursorAdapter,
  codex: codexAdapter,
};

export function getAdapter(platform: PlatformId = DEFAULT_PLATFORM_ID): PlatformAdapter {
  return ADAPTERS[platform];
}

export function getAdapterForSnapshot(snapshot: ProjectSnapshot): PlatformAdapter {
  const platform = snapshot.version.platform;
  if (!isPlatformId(platform)) {
    throw new UnknownPlatformError(platform);
  }
  return getAdapter(platform);
}
