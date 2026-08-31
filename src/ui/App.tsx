import { useCallback, useEffect, useRef, useState } from "react";
import type { PlatformId } from "../adapters/platform.js";
import type { Agent, ContextPreset, EffectiveConfiguration } from "../core/model/index.js";
import type { ScanStatusSummary } from "../application/scan-store.js";
import {
  ApiError,
  browseProjectFolder,
  fetchAgents,
  fetchEffectiveConfig,
  fetchExplain,
  fetchProject,
  fetchProjectConfig,
  fetchWarnings,
  formatVersion,
  scanProject,
  type AgentWarning,
} from "./api.js";
import { AgentList } from "./components/AgentList.js";
import { AgentSelector } from "./components/AgentSelector.js";
import {
  ContextSelector,
  DEFAULT_CONTEXT_PRESET,
} from "./components/ContextSelector.js";
import {
  loadStoredPlatform,
  loadStoredProjectPath,
  saveStoredPlatform,
  saveStoredProjectPath,
  ScanPanel,
} from "./components/ScanPanel.js";
import { GraphView } from "./components/GraphView.js";
import { EcosystemView } from "./components/EcosystemView.js";
import type { EcosystemBridgeTarget } from "./components/ResourceDetailPanel.js";
import { WhyPanel } from "./components/WhyPanel.js";
import { AgentEditor } from "./components/AgentEditor.js";
import { DeclaredEffectivePanel } from "./components/DeclaredEffective.js";
import { EffectiveCapabilities } from "./components/EffectiveCapabilities.js";
import { WarningsPanel, type WarningScope } from "./components/WarningsPanel.js";
import { DriftBanner } from "./components/DriftBanner.js";
import { DashboardNav, type DashboardTab } from "./components/DashboardNav.js";
import { SimulationView } from "./components/SimulationView.js";
import type { ManagedSimulationResult } from "./api.js";
import {
  clearAgentPending,
  countPendingChanges,
  createEmptyEditorState,
  toggleTool,
  type EditorPendingState,
} from "./state/editor-store.js";

function totalPendingChanges(agents: Agent[], pending: EditorPendingState): number {
  return agents.reduce((sum, agent) => sum + countPendingChanges(agent, pending), 0);
}

export function App() {
  const [summary, setSummary] = useState<ScanStatusSummary | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [projectPath, setProjectPath] = useState("");
  const [platform, setPlatform] = useState<PlatformId>("claude");
  const platformRef = useRef<PlatformId>("claude");
  const [fallbackPath, setFallbackPath] = useState("");
  const [browseUnavailable, setBrowseUnavailable] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const projectPathRef = useRef(projectPath);

  useEffect(() => {
    projectPathRef.current = projectPath;
  }, [projectPath]);

  useEffect(() => {
    platformRef.current = platform;
  }, [platform]);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsScan, setNeedsScan] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [contextPreset, setContextPreset] = useState<ContextPreset>(DEFAULT_CONTEXT_PRESET);
  const [unknownRate, setUnknownRate] = useState<number | null>(null);
  const [effectiveConfig, setEffectiveConfig] = useState<EffectiveConfiguration | null>(null);
  const [effectiveLoading, setEffectiveLoading] = useState(false);
  const [effectiveError, setEffectiveError] = useState<string | null>(null);
  const [selectedCapabilityId, setSelectedCapabilityId] = useState<string | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [explainData, setExplainData] = useState<Awaited<ReturnType<typeof fetchExplain>> | null>(
    null,
  );
  const [editorPending, setEditorPending] = useState<EditorPendingState>(createEmptyEditorState);
  const [activeTab, setActiveTab] = useState<DashboardTab>("ecosystem");
  const [allAgentWarnings, setAllAgentWarnings] = useState<AgentWarning[]>([]);
  const [allWarningsLoading, setAllWarningsLoading] = useState(false);
  const [allWarningsError, setAllWarningsError] = useState<string | null>(null);
  const [warningsScope, setWarningsScope] = useState<WarningScope>("agent");
  const [ecosystemReturnState, setEcosystemReturnState] = useState<{ resourceId: string } | null>(
    null,
  );
  const [restoreEcosystemResourceId, setRestoreEcosystemResourceId] = useState<string | null>(null);
  const [simulationResult, setSimulationResult] = useState<ManagedSimulationResult | null>(null);

  const loadDiscovery = useCallback(async () => {
    const project = await fetchProject();
    const agentList = await fetchAgents();
    setSummary(project);
    setAgents(agentList);
    const scannedPlatform = project.version.platform;
    if (
      scannedPlatform === "claude" ||
      scannedPlatform === "cursor" ||
      scannedPlatform === "codex"
    ) {
      setPlatform(scannedPlatform);
      platformRef.current = scannedPlatform;
      saveStoredPlatform(scannedPlatform);
    }
    setNeedsScan(false);
  }, []);

  const selectedAgent = selectedAgentId
    ? (agents.find((agent) => agent.id === selectedAgentId) ?? null)
    : null;

  const handleToggleTool = useCallback(
    (toolName: string) => {
      if (!selectedAgent) return;
      setEditorPending((current) => toggleTool(current, selectedAgent, toolName));
    },
    [selectedAgent],
  );

  const handleSelectCapability = useCallback((capabilityId: string) => {
    setSelectedCapabilityId(capabilityId);
    setActiveTab("capabilities");
  }, []);

  const handleSelectCapabilityFromGraph = useCallback((capabilityId: string) => {
    setSelectedCapabilityId(capabilityId);
  }, []);

  const handleCloseWhy = useCallback(() => {
    setSelectedCapabilityId(null);
  }, []);

  const handleReturnToEcosystem = useCallback(() => {
    if (!ecosystemReturnState) {
      return;
    }
    setRestoreEcosystemResourceId(ecosystemReturnState.resourceId);
    setEcosystemReturnState(null);
    setSelectedCapabilityId(null);
    setActiveTab("ecosystem");
  }, [ecosystemReturnState]);

  const handleEcosystemBridgeConsumed = useCallback(() => {
    setRestoreEcosystemResourceId(null);
  }, []);

  const handleClearPending = useCallback(() => {
    if (!selectedAgentId) return;
    setEditorPending((current) => clearAgentPending(current, selectedAgentId));
  }, [selectedAgentId]);

  const editorPendingCount = totalPendingChanges(agents, editorPending);

  const displayedWarnings =
    warningsScope === "agent"
      ? (effectiveConfig?.warnings ?? []).map((warning) => ({
          ...warning,
          ...(selectedAgentId ? { agentId: selectedAgentId } : {}),
        }))
      : allAgentWarnings;

  const runScan = useCallback(
    async (overridePath?: string, overridePlatform?: PlatformId) => {
      const pathToScan = (overridePath ?? projectPathRef.current).trim();
      const platformToScan = overridePlatform ?? platformRef.current;
      setScanning(true);
      setError(null);
      try {
        const result = await scanProject(pathToScan || undefined, platformToScan);
        if (pathToScan) {
          setProjectPath(pathToScan);
          saveStoredProjectPath(pathToScan);
        }
        setPlatform(platformToScan);
        saveStoredPlatform(platformToScan);
        await loadDiscovery();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Scan failed");
      } finally {
        setScanning(false);
      }
    },
    [loadDiscovery],
  );

  const handleBridgeToEffective = useCallback(
    async (target: EcosystemBridgeTarget, resourceId: string) => {
      setEcosystemReturnState({ resourceId });

      const needsPlatformSwitch = platformRef.current !== "claude";
      if (needsPlatformSwitch && projectPathRef.current.trim()) {
        await runScan(undefined, "claude");
      } else if (needsPlatformSwitch) {
        setPlatform("claude");
        platformRef.current = "claude";
        saveStoredPlatform("claude");
      }

      setContextPreset(DEFAULT_CONTEXT_PRESET);
      setSelectedAgentId(target.agentId);
      setSelectedCapabilityId(target.capabilityId ?? null);
      setActiveTab("capabilities");
    },
    [runScan],
  );

  const handlePlatformChange = useCallback(
    (nextPlatform: string) => {
      const parsed = nextPlatform as PlatformId;
      setPlatform(parsed);
      saveStoredPlatform(parsed);
      if (projectPathRef.current.trim()) {
        void runScan(undefined, parsed);
      }
    },
    [runScan],
  );

  const handleBrowse = useCallback(async () => {
    setBrowsing(true);
    setError(null);
    try {
      const result = await browseProjectFolder();
      if (!result.cancelled) {
        setBrowseUnavailable(false);
        await runScan(result.path);
        return;
      }

      if (result.reason === "unavailable") {
        setBrowseUnavailable(true);
        setError(
          "Folder picker is unavailable on this machine. Enter a project path below or set CAPSIGHT_PROJECT_PATH.",
        );
        return;
      }

      if (result.reason === "busy") {
        setError("Folder picker is already open.");
        return;
      }

      if (result.reason === "timeout") {
        setError("Folder picker timed out. Try again or enter a path manually.");
        setBrowseUnavailable(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Browse failed");
    } finally {
      setBrowsing(false);
    }
  }, [runScan]);

  const handleRescan = useCallback(() => {
    void runScan();
  }, [runScan]);

  const handleFallbackScan = useCallback(
    (path: string) => {
      const trimmed = path.trim();
      if (!trimmed) return;
      void runScan(trimmed);
    },
    [runScan],
  );

  useEffect(() => {
    if (agents.length === 0) {
      setSelectedAgentId(null);
      return;
    }

    setSelectedAgentId((current) => {
      if (current && agents.some((agent) => agent.id === current)) {
        return current;
      }
      const active = agents.find((agent) => agent.status === "active");
      return active?.id ?? agents[0].id;
    });
  }, [agents]);

  useEffect(() => {
    if (!selectedAgentId) {
      setUnknownRate(null);
      setEffectiveConfig(null);
      setEffectiveError(null);
      setSelectedCapabilityId(null);
      return;
    }

    const agentId: string = selectedAgentId;
    let cancelled = false;

    async function loadEffective() {
      setEffectiveLoading(true);
      setEffectiveError(null);
      setSelectedCapabilityId(null);
      try {
        const effective = await fetchEffectiveConfig(agentId, contextPreset);
        if (!cancelled) {
          setEffectiveConfig(effective);
          setUnknownRate(effective.unknownRate);
        }
      } catch (err) {
        if (!cancelled) {
          setEffectiveConfig(null);
          setUnknownRate(null);
          setEffectiveError(
            err instanceof Error ? err.message : "Failed to load effective configuration",
          );
        }
      } finally {
        if (!cancelled) {
          setEffectiveLoading(false);
        }
      }
    }

    void loadEffective();
    return () => {
      cancelled = true;
    };
  }, [selectedAgentId, contextPreset]);

  useEffect(() => {
    if (!summary) {
      setAllAgentWarnings([]);
      setAllWarningsError(null);
      return;
    }

    let cancelled = false;

    async function loadAllWarnings() {
      setAllWarningsLoading(true);
      setAllWarningsError(null);
      try {
        const payload = await fetchWarnings(contextPreset);
        if (!cancelled) {
          setAllAgentWarnings(payload.warnings);
        }
      } catch (err) {
        if (!cancelled) {
          setAllAgentWarnings([]);
          setAllWarningsError(
            err instanceof Error ? err.message : "Failed to load warnings",
          );
        }
      } finally {
        if (!cancelled) {
          setAllWarningsLoading(false);
        }
      }
    }

    void loadAllWarnings();
    return () => {
      cancelled = true;
    };
  }, [summary, contextPreset]);

  useEffect(() => {
    if (!selectedAgentId || !selectedCapabilityId) {
      setExplainData(null);
      setExplainError(null);
      return;
    }

    const agentId = selectedAgentId;
    const capabilityId = selectedCapabilityId;
    let cancelled = false;

    async function loadExplain() {
      setExplainLoading(true);
      setExplainError(null);
      try {
        const explain = await fetchExplain(capabilityId, agentId, contextPreset);
        if (!cancelled) {
          setExplainData(explain);
        }
      } catch (err) {
        if (!cancelled) {
          setExplainData(null);
          setExplainError(err instanceof Error ? err.message : "Failed to load explanation");
        }
      } finally {
        if (!cancelled) {
          setExplainLoading(false);
        }
      }
    }

    void loadExplain();
    return () => {
      cancelled = true;
    };
  }, [selectedAgentId, selectedCapabilityId, contextPreset]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);
      setError(null);
      let initialPath = loadStoredProjectPath() ?? "";
      const storedPlatform = loadStoredPlatform();
      if (
        storedPlatform === "claude" ||
        storedPlatform === "cursor" ||
        storedPlatform === "codex"
      ) {
        setPlatform(storedPlatform);
        platformRef.current = storedPlatform;
      }
      try {
        if (!initialPath) {
          const config = await fetchProjectConfig();
          initialPath = config.defaultProjectPath;
        }
        if (!cancelled) {
          setProjectPath(initialPath);
          setFallbackPath(initialPath);
        }

        await loadDiscovery();
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setNeedsScan(true);
          await runScan(initialPath.trim() || undefined);
        } else {
          setError(err instanceof Error ? err.message : "Failed to load discovery data");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [loadDiscovery, runScan]);

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="dashboard-brand">
          <h1>Capsight</h1>
          <p>Claude Agent Configuration Inspector</p>
        </div>

        <div className="dashboard-header-actions">
          {summary && (
            <AgentSelector
              compact
              agents={agents}
              selectedAgentId={selectedAgentId}
              onAgentChange={setSelectedAgentId}
            />
          )}
          {(needsScan || summary) && (
            <ScanPanel
              projectPath={projectPath}
              platform={platform}
              platformVersion={summary ? formatVersion(summary.version) : undefined}
              onPlatformChange={handlePlatformChange}
              onBrowse={handleBrowse}
              onRescan={handleRescan}
              onFallbackScan={handleFallbackScan}
              browsing={browsing}
              scanning={scanning}
              browseUnavailable={browseUnavailable}
              fallbackPath={fallbackPath}
              onFallbackPathChange={setFallbackPath}
              error={error}
            />
          )}
        </div>
      </header>

      {loading && !summary && !scanning && (
        <section className="panel loading-panel">
          <p>Loading discovery data…</p>
        </section>
      )}

      {error && !scanning && !summary && (
        <section className="panel error-panel">
          <p className="error-message">{error}</p>
        </section>
      )}

      {summary && (
        <div className="dashboard-shell">
          <DashboardNav
            activeTab={activeTab}
            onTabChange={setActiveTab}
            editorPendingCount={editorPendingCount}
          />

          <main className="dashboard-content">
            <DriftBanner
              platform={platform}
              version={formatVersion(summary.version)}
              effective={effectiveConfig}
              loading={effectiveLoading}
              onSelectCapability={handleSelectCapability}
            />

            {activeTab === "ecosystem" && (
              <EcosystemView
                refreshKey={summary.scannedAt}
                agents={agents}
                currentPlatform={platform}
                restoreResourceId={restoreEcosystemResourceId}
                onRestoreResourceConsumed={handleEcosystemBridgeConsumed}
                onBridgeToEffective={handleBridgeToEffective}
              />
            )}

            {activeTab === "context" && (
              <ContextSelector
                preset={contextPreset}
                onPresetChange={setContextPreset}
                unknownRate={unknownRate}
                loading={effectiveLoading}
                error={effectiveError}
                hasSelectedAgent={selectedAgentId !== null}
                effective={effectiveConfig}
                agent={selectedAgent}
              />
            )}

            {activeTab === "agents" && <AgentList agents={agents} />}

            {activeTab === "editor" && selectedAgent && (
              <AgentEditor
                agent={selectedAgent}
                effective={effectiveConfig}
                effectiveLoading={effectiveLoading}
                pending={editorPending}
                onToggleTool={handleToggleTool}
                onClearPending={handleClearPending}
              />
            )}

            {activeTab === "editor" && !selectedAgent && (
              <section className="panel">
                <p className="empty-state">Select an agent in the header to edit tools.</p>
              </section>
            )}

            {activeTab === "capabilities" && selectedAgentId && (
              <div
                className={`tab-capabilities${
                  selectedCapabilityId ? " tab-capabilities--with-detail" : ""
                }`}
              >
                {ecosystemReturnState && (
                  <div
                    className="ecosystem-bridge-return-banner"
                    data-testid="ecosystem-bridge-return-banner"
                  >
                    <p>
                      Opened from declared inventory. Effective resolution — one context (
                      <code>{contextPreset}</code>).
                    </p>
                    <button type="button" onClick={handleReturnToEcosystem}>
                      Back to Ecosystem canvas
                    </button>
                  </div>
                )}
                <DeclaredEffectivePanel effective={effectiveConfig} agent={selectedAgent} />
                <EffectiveCapabilities
                  effective={effectiveConfig}
                  loading={effectiveLoading}
                  error={effectiveError}
                  selectedCapabilityId={selectedCapabilityId}
                  onSelectCapability={handleSelectCapability}
                  warnings={effectiveConfig?.warnings ?? []}
                />
                {selectedCapabilityId && (
                  <WhyPanel
                    explain={explainData}
                    loading={explainLoading}
                    error={explainError}
                    onClose={handleCloseWhy}
                  />
                )}
              </div>
            )}

            {activeTab === "capabilities" && !selectedAgentId && (
              <section className="panel">
                <p className="empty-state">Select an agent in the header to view capabilities.</p>
              </section>
            )}

            {activeTab === "warnings" && (
              <div className="tab-warnings">
                <div className="warnings-scope-toggle" role="group" aria-label="Warning scope">
                  <button
                    type="button"
                    className={`warnings-scope-button${warningsScope === "agent" ? " warnings-scope-button-active" : ""}`}
                    disabled={!selectedAgentId}
                    onClick={() => setWarningsScope("agent")}
                  >
                    Current agent
                  </button>
                  <button
                    type="button"
                    className={`warnings-scope-button${warningsScope === "all" ? " warnings-scope-button-active" : ""}`}
                    onClick={() => setWarningsScope("all")}
                  >
                    All active agents
                  </button>
                </div>
                {warningsScope === "agent" && !selectedAgentId && (
                  <section className="panel">
                    <p className="empty-state">Select an agent in the header to view warnings.</p>
                  </section>
                )}
                {(warningsScope === "all" || selectedAgentId) && (
                  <>
                    {allWarningsLoading && warningsScope === "all" && (
                      <p className="empty-state">Loading warnings…</p>
                    )}
                    {allWarningsError && warningsScope === "all" && (
                      <p className="error-message">{allWarningsError}</p>
                    )}
                    {effectiveLoading && warningsScope === "agent" && (
                      <p className="empty-state">Loading warnings…</p>
                    )}
                    {effectiveError && warningsScope === "agent" && (
                      <p className="error-message">{effectiveError}</p>
                    )}
                    {!allWarningsLoading &&
                      !effectiveLoading &&
                      !(warningsScope === "all" && allWarningsError) &&
                      !(warningsScope === "agent" && effectiveError) && (
                        <WarningsPanel
                          warnings={displayedWarnings}
                          scope={warningsScope}
                          agentId={selectedAgentId}
                          emptyMessage={
                            warningsScope === "agent"
                              ? "No warnings for this agent and context."
                              : "No warnings across active agents."
                          }
                        />
                      )}
                  </>
                )}
              </div>
            )}

            {activeTab === "graph" && (
              <div
                className={`tab-graph${selectedCapabilityId ? " tab-graph--with-detail" : ""}`}
              >
                <GraphView
                  context={contextPreset}
                  selectedCapabilityId={selectedCapabilityId}
                  onSelectCapability={handleSelectCapabilityFromGraph}
                />
                {selectedCapabilityId && selectedAgentId && (
                  <WhyPanel
                    explain={explainData}
                    loading={explainLoading}
                    error={explainError}
                    onClose={handleCloseWhy}
                  />
                )}
              </div>
            )}

            {activeTab === "simulation" && (
              <SimulationView
                platform={platform}
                result={simulationResult}
                onResult={setSimulationResult}
              />
            )}
          </main>
        </div>
      )}
    </div>
  );
}
