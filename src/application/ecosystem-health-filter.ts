import type {
  EcosystemHealthSummary,
  HealthCountLink,
  HealthFilterId,
} from "./ecosystem-health.js";

export type { HealthFilterId } from "./ecosystem-health.js";

export function healthFilterResourceIds(
  health: EcosystemHealthSummary,
  filterId: HealthFilterId | null,
): string[] | null {
  if (!filterId) {
    return null;
  }

  const links: HealthCountLink[] = [
    health.localOverrides,
    health.unresolvedCollisions,
    health.compatUnknown,
    health.warnings.info,
    health.warnings.warning,
    health.warnings.critical,
  ];

  for (const platform of health.platforms) {
    links.push(
      platform.agents.active,
      platform.agents.invalid,
      platform.agents.ambiguous,
      platform.agents.shadowed,
      platform.skills,
      platform.instructions,
      platform.mcpNotSupported,
      platform.mcpUnknown,
    );
  }

  const match = links.find((link) => link.id === filterId);
  return match ? match.resourceIds : null;
}
