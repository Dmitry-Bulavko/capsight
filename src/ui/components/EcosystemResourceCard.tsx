import type { Scope } from "../../core/model/index.js";
import {
  ecosystemBlockKindHint,
  ecosystemKindGlow,
  formatEcosystemBlockKind,
  ecosystemBlockKindColor,
} from "../ecosystem-block-kinds.js";
import type { EcosystemResourceNodeData } from "../ecosystem-layout.js";
import { PLATFORM_ICON_META } from "../platform-icons.js";
import type { PlatformId } from "../../adapters/platform.js";
import { CompatPlatformIcons } from "./CompatPlatformIcons.js";
import { EcosystemBlockKindIcon } from "./EcosystemBlockKindIcon.js";
import { PlatformIconMark } from "./PlatformIconMark.js";

function ScopeBadge({ scope }: { scope: Scope }) {
  if (scope !== "local") {
    return null;
  }

  return <span className="ecosystem-resource-scope-badge">local</span>;
}

function SourcePlatformBadge({ platform }: { platform: string }) {
  if (platform !== "claude" && platform !== "cursor" && platform !== "codex") {
    return <span className="ecosystem-resource-source-badge">{platform}</span>;
  }

  const meta = PLATFORM_ICON_META[platform as PlatformId];
  return (
    <span className="ecosystem-resource-source-badge" title={`Declared on ${meta.label}`}>
      <PlatformIconMark platform={platform as PlatformId} />
      <span className="ecosystem-resource-source-label">{meta.shortLabel}</span>
    </span>
  );
}

export function EcosystemResourceCard({
  label,
  kind,
  platform,
  scope,
  compat,
  dimmed,
}: EcosystemResourceNodeData) {
  const kindColor = ecosystemBlockKindColor(kind);
  const hint = ecosystemBlockKindHint(kind);

  return (
    <div
      className={`ecosystem-resource-card${dimmed ? " ecosystem-resource-card--dimmed" : ""}`}
      style={{
        borderColor: kindColor,
        boxShadow: ecosystemKindGlow(kindColor),
      }}
    >
      <header className="ecosystem-resource-card-header">
        <span className="ecosystem-resource-card-kind">{formatEcosystemBlockKind(kind)}</span>
        <span className="ecosystem-resource-card-kind-icon" title={hint} aria-label={hint}>
          <EcosystemBlockKindIcon kind={kind} />
        </span>
      </header>

      <div className="ecosystem-resource-card-label">{label}</div>

      <div className="ecosystem-resource-card-footer">
        <div className="ecosystem-resource-card-meta">
          <SourcePlatformBadge platform={platform} />
          <ScopeBadge scope={scope} />
        </div>
        <CompatPlatformIcons compat={compat} />
      </div>
    </div>
  );
}
