import type { SourceInfo } from "../../core/model/index.js";

export function formatSourceLine(source: SourceInfo): string {
  const path = source.path ?? source.scope;
  if (source.fieldPath) {
    return `${path} — ${source.fieldPath}`;
  }
  return path;
}
