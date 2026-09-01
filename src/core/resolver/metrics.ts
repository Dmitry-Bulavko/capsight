import type { ResolvedCapability } from "../model/index.js";

export function computeUnknownRate(capabilities: ResolvedCapability[]): number {
  if (capabilities.length === 0) {
    return 0;
  }
  const unknownCount = capabilities.filter((cap) => cap.status === "unknown").length;
  return unknownCount / capabilities.length;
}
