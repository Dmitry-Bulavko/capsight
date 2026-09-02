import type { EffectiveConfiguration, ResolvedCapability } from "../core/model/index.js";

export function capabilityKindForId(
  capabilityId: string,
  effective: EffectiveConfiguration | null,
): ResolvedCapability["kind"] {
  return (
    effective?.capabilities.find((capability) => capability.capabilityId === capabilityId)?.kind ??
    "tool"
  );
}

export function opensAsideDetail(kind: ResolvedCapability["kind"]): boolean {
  return kind === "tool" || kind === "permission";
}

export function shouldOpenAsideDetail(
  capabilityId: string,
  effective: EffectiveConfiguration | null,
): boolean {
  return opensAsideDetail(capabilityKindForId(capabilityId, effective));
}
