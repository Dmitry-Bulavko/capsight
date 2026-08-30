import type { PlatformId } from "../adapters/platform.js";

export interface PlatformIconMeta {
  label: string;
  shortLabel: string;
  iconSrc: string;
  iconTone: "brand" | "neutral" | "white";
  iconColor?: string;
}

export const PLATFORM_ICON_META: Record<PlatformId, PlatformIconMeta> = {
  claude: {
    label: "Claude Code",
    shortLabel: "Claude",
    iconSrc: "/agent-systems/claude-code.png",
    iconTone: "brand",
    iconColor: "#D97757",
  },
  cursor: {
    label: "Cursor",
    shortLabel: "Cursor",
    iconSrc: "/agent-systems/cursor.png",
    iconTone: "neutral",
  },
  codex: {
    label: "Codex",
    shortLabel: "Codex",
    iconSrc: "/agent-systems/codex.png",
    iconTone: "neutral",
  },
};
