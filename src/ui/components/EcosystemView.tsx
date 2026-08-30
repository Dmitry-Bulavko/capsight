import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  type Node,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ApiError,
  fetchEcosystem,
  fetchEcosystemResource,
  fetchEcosystemResourceContent,
  isMarkdownContentKind,
  type EcosystemResourceDetail,
  type ResourceContentResult,
} from "../api.js";
import {
  ECOSYSTEM_BLOCK_COLORS,
  ECOSYSTEM_FILTER_ALL,
  layoutEcosystemGraph,
  type EcosystemBlockNodeData,
  type EcosystemResourceNodeData,
} from "../ecosystem-layout.js";
import {
  healthFilterResourceIds as resolveHealthFilterIds,
  type HealthFilterId,
} from "../../application/ecosystem-health.js";
import { CompatBadges } from "./CompatBadges.js";
import { EcosystemHealth } from "./EcosystemHealth.js";
import {
  PLATFORM_FILTER_ALL,
  PlatformFilter,
  platformFilterLabel,
  type PlatformFilterValue,
} from "./PlatformFilter.js";
import { ResourceDetailPanel } from "./ResourceDetailPanel.js";

function ScopeBadge({ scope }: { scope: string }) {
  const className =
    scope === "local"
      ? "ecosystem-scope-badge ecosystem-scope-badge-local"
      : "ecosystem-scope-badge";
  return <span className={className}>{scope}</span>;
}

function EcosystemBlockNode({ data }: { data: EcosystemBlockNodeData }) {
  return (
    <div className="ecosystem-block">
      <header
        className="ecosystem-block-header"
        style={{ borderColor: ECOSYSTEM_BLOCK_COLORS[data.blockKind] }}
      >
        <span className="ecosystem-block-title">{data.label}</span>
        {!data.empty && <span className="ecosystem-block-count">{data.count}</span>}
      </header>
      {data.empty && <p className="ecosystem-block-empty">No resources discovered</p>}
    </div>
  );
}

function EcosystemResourceNode({ data }: { data: EcosystemResourceNodeData }) {
  return (
    <div
      className={`ecosystem-resource-node${data.dimmed ? " ecosystem-resource-node-dimmed" : ""}`}
    >
      <div className="ecosystem-resource-meta">
        <span className="ecosystem-platform-badge">{data.platform}</span>
        <ScopeBadge scope={data.scope} />
      </div>
      <span className="ecosystem-resource-label">{data.label}</span>
      <CompatBadges compat={data.compat} />
    </div>
  );
}

function ecosystemNodeTypes() {
  return {
    ecosystemBlock: EcosystemBlockNode,
    ecosystemResource: EcosystemResourceNode,
  };
}

function contentErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return "Resource file not found or is not readable.";
    }
    if (error.status === 403) {
      return "Content read refused — resolved path escapes scanned roots.";
    }
    if (error.status === 415) {
      return "Content is not served for this resource kind.";
    }
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Failed to load resource content.";
}

interface EcosystemViewProps {
  refreshKey?: string;
}

export function EcosystemView({ refreshKey }: EcosystemViewProps) {
  const [payload, setPayload] = useState<Awaited<ReturnType<typeof fetchEcosystem>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [filterPlatform, setFilterPlatform] = useState<PlatformFilterValue>(PLATFORM_FILTER_ALL);
  const [healthFilterId, setHealthFilterId] = useState<HealthFilterId | null>(null);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EcosystemResourceDetail | null>(null);
  const [content, setContent] = useState<ResourceContentResult | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [contentLoading, setContentLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [contentError, setContentError] = useState<string | null>(null);
  const nodeTypes = useMemo(() => ecosystemNodeTypes(), []);

  useEffect(() => {
    let cancelled = false;

    async function loadEcosystem() {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchEcosystem();
        if (!cancelled) {
          setPayload(result);
        }
      } catch (err) {
        if (!cancelled) {
          setPayload(null);
          setError(err instanceof Error ? err.message : "Failed to load ecosystem inventory");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadEcosystem();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    if (!selectedResourceId) {
      setDetail(null);
      setContent(null);
      setDetailError(null);
      setContentError(null);
      setDetailLoading(false);
      setContentLoading(false);
      return;
    }

    let cancelled = false;
    setDetail(null);
    setContent(null);
    setDetailError(null);
    setContentError(null);
    setDetailLoading(true);
    setContentLoading(true);

    async function loadDetail() {
      try {
        const result = await fetchEcosystemResource(selectedResourceId!);
        if (cancelled) {
          return;
        }
        setDetail(result);
        setDetailLoading(false);

        if (!isMarkdownContentKind(result.resource.kind)) {
          setContentLoading(false);
          return;
        }

        try {
          const body = await fetchEcosystemResourceContent(selectedResourceId!);
          if (!cancelled) {
            setContent(body);
          }
        } catch (err) {
          if (!cancelled) {
            setContentError(contentErrorMessage(err));
          }
        } finally {
          if (!cancelled) {
            setContentLoading(false);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setDetailError(err instanceof Error ? err.message : "Failed to load resource details");
          setDetailLoading(false);
          setContentLoading(false);
        }
      }
    }

    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedResourceId]);

  const activeHealthFilterIds = useMemo(() => {
    if (!payload?.health || !healthFilterId) {
      return null;
    }
    return resolveHealthFilterIds(payload.health, healthFilterId);
  }, [payload, healthFilterId]);

  const layout = useMemo(() => {
    if (!payload) {
      return { nodes: [], edges: [], dimmedCount: 0 };
    }
    return layoutEcosystemGraph({
      resources: payload.resources,
      overlaps: payload.overlaps,
      filterPlatform: filterPlatform === PLATFORM_FILTER_ALL ? ECOSYSTEM_FILTER_ALL : filterPlatform,
      filterResourceIds: activeHealthFilterIds,
    });
  }, [payload, filterPlatform, activeHealthFilterIds]);

  const { nodes, edges, dimmedCount } = layout;

  const nodesWithSelection = useMemo(
    () =>
      nodes.map((node) =>
        node.type === "ecosystemResource"
          ? ({
              ...node,
              selected: node.id === selectedResourceId,
              className: [
                node.className,
                node.id === selectedResourceId ? "ecosystem-resource-selected" : "",
              ]
                .filter(Boolean)
                .join(" "),
            } satisfies Node)
          : node,
      ),
    [nodes, selectedResourceId],
  );

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    if (node.type !== "ecosystemResource") {
      return;
    }
    setSelectedResourceId(node.id);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedResourceId(null);
  }, []);

  useEffect(() => {
    if (!flowInstance || nodes.length === 0) return;
    const frame = requestAnimationFrame(() => {
      void flowInstance.fitView({ padding: 0.1, duration: 200 });
    });
    return () => cancelAnimationFrame(frame);
  }, [flowInstance, nodes]);

  const overlapCount = payload?.overlaps.length ?? 0;
  const inventoryCaption =
    filterPlatform === PLATFORM_FILTER_ALL
      ? "Declared inventory — all platforms"
      : `Declared inventory — read against ${platformFilterLabel(filterPlatform)}`;

  return (
    <section className="panel ecosystem-panel">
      <h2>Ecosystem</h2>
      <p className="ecosystem-note">{inventoryCaption}</p>

      {payload && (
        <PlatformFilter
          detection={payload.detection}
          value={filterPlatform}
          onChange={setFilterPlatform}
          dimmedCount={dimmedCount}
        />
      )}

      {overlapCount > 0 && (
        <ul className="graph-legend" aria-label="Overlap edges">
          <li>
            <span className="graph-legend-swatch" style={{ backgroundColor: "#81c995" }} />
            overlaps (resolved)
          </li>
          <li>
            <span
              className="graph-legend-swatch ecosystem-legend-unresolved"
              style={{ backgroundColor: "#fdd663" }}
            />
            overlaps (unresolved)
          </li>
        </ul>
      )}

      {loading && <p className="empty-state">Loading ecosystem inventory…</p>}
      {!loading && error && <p className="error-message">{error}</p>}

      {!loading && !error && payload && (
        <div
          className={`ecosystem-main${selectedResourceId ? " ecosystem-main--with-detail" : ""}${healthFilterId ? " ecosystem-main--filtered" : ""}`}
        >
          <EcosystemHealth
            health={payload.health}
            activeFilterId={healthFilterId}
            onFilterChange={setHealthFilterId}
          />
          <div className="ecosystem-container" data-testid="ecosystem-canvas">
            <ReactFlow
              nodes={nodesWithSelection}
              edges={edges}
              nodeTypes={nodeTypes}
              onInit={setFlowInstance}
              onNodeClick={handleNodeClick}
              minZoom={0.25}
              maxZoom={1.5}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable
              panOnDrag
              zoomOnScroll
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={16} color="#3c4043" />
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>

          {selectedResourceId && (
            <ResourceDetailPanel
              detail={detail}
              content={content}
              detailLoading={detailLoading}
              contentLoading={contentLoading}
              detailError={detailError}
              contentError={contentError}
              contentUnavailable={detail ? !isMarkdownContentKind(detail.resource.kind) : false}
              onClose={handleCloseDetail}
            />
          )}
        </div>
      )}
    </section>
  );
}
