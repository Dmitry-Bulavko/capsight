import type { ResolutionReason, SourceInfo } from "../model/index.js";

export function makeReason(
  type: ResolutionReason["type"],
  message: string,
  source?: SourceInfo,
  matrixRef?: string,
): ResolutionReason {
  return matrixRef
    ? { type, message, source, matrixRef }
    : source
      ? { type, message, source }
      : { type, message };
}
