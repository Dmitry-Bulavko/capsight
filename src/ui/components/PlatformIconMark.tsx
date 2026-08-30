import { PLATFORM_ICON_META } from "../platform-icons.js";
import type { PlatformId } from "../../adapters/platform.js";

interface PlatformIconMarkProps {
  platform: PlatformId;
}

function MaskedPlatformIcon({
  iconSrc,
  color,
  tone,
}: {
  iconSrc: string;
  color: string;
  tone: "brand" | "white";
}) {
  return (
    <span
      className={`agent-system-icon-mask agent-system-icon-mask--${tone}`}
      style={{
        backgroundColor: color,
        maskImage: `url(${iconSrc})`,
        WebkitMaskImage: `url(${iconSrc})`,
      }}
      aria-hidden="true"
    />
  );
}

export function PlatformIconMark({ platform }: PlatformIconMarkProps) {
  const meta = PLATFORM_ICON_META[platform];

  if (meta.iconTone === "brand" && meta.iconColor) {
    return <MaskedPlatformIcon iconSrc={meta.iconSrc} color={meta.iconColor} tone="brand" />;
  }

  if (meta.iconTone === "white") {
    return <MaskedPlatformIcon iconSrc={meta.iconSrc} color="#ffffff" tone="white" />;
  }

  return (
    <img
      src={meta.iconSrc}
      alt=""
      className="agent-system-icon-image agent-system-icon-image--neutral"
      draggable={false}
    />
  );
}
