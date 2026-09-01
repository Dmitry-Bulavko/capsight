import { createHash } from "node:crypto";
import type { Scope } from "../../../core/model/index.js";

export const SCOPE_PRIORITY: Record<Scope, number> = {
  managed: 50,
  cli: 40,
  project: 30,
  "nested-project": 30,
  local: 25,
  user: 20,
  plugin: 10,
  builtin: 5,
  unknown: 0,
};

export function agentIdFromPath(filePath: string): string {
  return shortHash("", filePath);
}

export function shortHash(prefix: string, input: string): string {
  const payload = prefix ? `${prefix}${input}` : input;
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}
