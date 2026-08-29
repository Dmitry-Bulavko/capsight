import { AGENT_SYSTEM_META, type AgentSystemId } from "../workflow-lab-types.js";

interface AgentSystemIconProps {
  systemId: AgentSystemId;
}

function MaskedAgentSystemIcon({
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

export function AgentSystemIconMark({ systemId }: AgentSystemIconProps) {
  const meta = AGENT_SYSTEM_META[systemId];

  if (meta.iconTone === "brand" && meta.iconColor) {
    return <MaskedAgentSystemIcon iconSrc={meta.iconSrc} color={meta.iconColor} tone="brand" />;
  }

  if (meta.iconTone === "white") {
    return <MaskedAgentSystemIcon iconSrc={meta.iconSrc} color="#ffffff" tone="white" />;
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
