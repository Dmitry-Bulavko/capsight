import type { GraphNodeKind } from "../../core/graph/build-graph.js";
import type { Scope } from "../../core/model/index.js";
import { EcosystemResourceCard } from "./EcosystemResourceCard.js";
import { GraphCapabilityCard } from "./GraphCapabilityCard.js";
import { GraphFlowNodeShell } from "./GraphFlowNodeShell.js";
import { graphAgentCompat, graphAgentPlatform } from "../graph-agent-card.js";

function GraphAgentNode({
  label,
  platform,
  scope,
}: {
  label: string;
  platform?: string;
  scope?: Scope;
}) {
  const resolvedPlatform = graphAgentPlatform(platform);
  return (
    <EcosystemResourceCard
      label={label}
      kind="agent"
      blockKind="agent"
      platform={resolvedPlatform}
      scope={scope ?? "project"}
      compat={graphAgentCompat(resolvedPlatform)}
      dimmed={false}
    />
  );
}

export function graphNodeTypes() {
  return {
    default: ({
      data,
    }: {
      data: {
        label: string;
        kind: GraphNodeKind;
        platform?: string;
        scope?: Scope;
      };
    }) =>
      data.kind === "agent" ? (
        <GraphFlowNodeShell>
          <GraphAgentNode label={data.label} platform={data.platform} scope={data.scope} />
        </GraphFlowNodeShell>
      ) : (
        <GraphFlowNodeShell>
          <GraphCapabilityCard kind={data.kind} label={data.label} />
        </GraphFlowNodeShell>
      ),
  };
}
