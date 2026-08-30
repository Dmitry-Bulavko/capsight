import { PLATFORM_IDS, type PlatformId } from "../../adapters/platform.js";
import type { CompatSupport } from "../../core/compat/index.js";
import type { ResourceCompatVerdicts } from "../../server/routes/ecosystem.js";
import { PLATFORM_ICON_META } from "../platform-icons.js";
import {
  buildCompatBadgeTrace,
  compatBadgeAriaLabel,
  compatBadgeTitle,
  resolveCompatBadgeState,
} from "./CompatBadges.js";
import { PlatformIconMark } from "./PlatformIconMark.js";

const SUPPORT_GROUP_ORDER: CompatSupport[] = ["not-supported", "unknown", "supported"];

const SUPPORT_ICON_CLASS: Record<CompatSupport, string> = {
  supported: "ecosystem-platform-icon--supported",
  "not-supported": "ecosystem-platform-icon--not-supported",
  unknown: "ecosystem-platform-icon--unknown",
};

function groupPlatformsBySupport(
  compat: ResourceCompatVerdicts,
): Array<{ support: CompatSupport; platforms: PlatformId[] }> {
  return SUPPORT_GROUP_ORDER.map((support) => ({
    support,
    platforms: PLATFORM_IDS.filter(
      (platform) =>
        resolveCompatBadgeState(compat[platform] ?? { support: "unknown", enforcement: "unknown" }) ===
        support,
    ),
  })).filter((group) => group.platforms.length > 0);
}

interface CompatPlatformIconsProps {
  compat: ResourceCompatVerdicts;
}

export function CompatPlatformIcons({ compat }: CompatPlatformIconsProps) {
  const groups = groupPlatformsBySupport(compat);

  if (groups.length === 0) {
    return null;
  }

  return (
    <div className="ecosystem-platform-icons" data-testid="compat-platform-icons">
      <span className="ecosystem-platform-icons-label">Platforms</span>
      <div className="ecosystem-platform-icon-groups" aria-label="Platform compatibility">
        {groups.map((group) => (
          <ul
            key={group.support}
            className={`ecosystem-platform-icon-group ecosystem-platform-icon-group--${group.support}`}
          >
            {group.platforms.map((platform) => {
              const trace = buildCompatBadgeTrace(
                platform,
                compat[platform] ?? { support: "unknown", enforcement: "unknown" },
              );
              return (
                <li
                  key={platform}
                  className={`ecosystem-platform-icon ${SUPPORT_ICON_CLASS[group.support]}`}
                  title={compatBadgeTitle(trace)}
                  aria-label={compatBadgeAriaLabel(trace)}
                >
                  <PlatformIconMark platform={platform} />
                  <span className="visually-hidden">{PLATFORM_ICON_META[platform].shortLabel}</span>
                </li>
              );
            })}
          </ul>
        ))}
      </div>
    </div>
  );
}
