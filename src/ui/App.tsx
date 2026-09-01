import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PlatformId } from "../adapters/platform.js";
import type { Agent, ContextPreset, EffectiveConfiguration } from "../core/model/index.js";
import type { ScanStatusSummary } from "../application/scan-store.js";
import {
  ApiError,
  browseProjectFolder,
  fetchAgents,
  fetchEffectiveConfig,
  fetchExplain,
  fetchObservedSession,
  fetchProject,
  fetchProjectConfig,
  fetchWarnings,
  formatVersion,
  scanProject,
  type AgentWarning,
  type ObservedSessionPayload,
} from "./api.js";
import { AgentsWorkspace } from "./components/AgentsWorkspace.js";
import type { AgentInspectorTab } from "./components/AgentInspectorNav.js";
import {
  loadStoredPlatform,
  loadStoredProjectPath,
  saveStoredPlatform,
  saveStoredProjectPath,
  ScanPanel,
} from "./components/ScanPanel.js";
import { EcosystemView } from "./components/EcosystemView.js";
import type { EcosystemBridgeTarget } from "./components/ResourceDetailPanel.js";
import { DashboardNav, type DashboardTab } from "./components/DashboardNav.js";
import { SimulationView } from "./components/SimulationView.js";
import type { ManagedSimulationResult } from "./api.js";
import { indexObservedCapabilities } from "../core/observed/session.js";
import {
  clearAgentPending,
  countPendingChanges,
  createEmptyEditorState,
  toggleTool,
  type EditorPendingState,
} from "./state/editor-store.js";
import { DEFAULT_CONTEXT_PRESET } from "./components/ContextSelector.js";
import type { WarningScope } from "./components/WarningsPanel.js";

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
  const [agentInspectorTab, setAgentInspectorTab] = useState<AgentInspectorTab>("overview");
  const [allAgentWarnings, setAllAgentWarnings] = useState<AgentWarning[]>([]);
  const [allWarningsLoading, setAllWarningsLoading] = useState(false);
  const [allWarningsError, setAllWarningsError] = useState<string | null>(null);
  const [warningsScope, setWarningsScope] = useState<WarningScope>("agent");
  const [ecosystemReturnState, setEcosystemReturnState] = useState<{ resourceId: string } | null>(
    null,
  );
  const [restoreEcosystemResourceId, setRestoreEcosystemResourceId] = useState<string | null>(null);
  const [simulationResult, setSimulationResult] = useState<ManagedSimulationResult | null>(null);
  const [observedSession, setObservedSession] = useState<ObservedSessionPayload | null>(null);
  const observedById = useMemo(
    () =>
      observedSession
        ? indexObservedCapabilities(observedSession.capabilities)
        : null,
    [observedSession],
  );
  const observedSessionActive = observedSession !== null;

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

  const handleSelectCapabilityInWorkspace = useCallback((capabilityId: string) => {
    setSelectedCapabilityId(capabilityId);
    setAgentInspectorTab("capabilities");
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

  const selectedAgentEditorPendingCount = selectedAgent
    ? countPendingChanges(selectedAgent, editorPending)
    : 0;

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
      setAgentInspectorTab("capabilities");
      setActiveTab("agents");
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
        const observed = await fetchObservedSession();
        if (!cancelled) {
          setObservedSession(observed);
        }
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
          <DashboardNav activeTab={activeTab} onTabChange={setActiveTab} />

          <main className="dashboard-content">
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

            {activeTab === "agents" && (
              <AgentsWorkspace
                platform={platform}
                scanVersion={formatVersion(summary.version)}
                agents={agents}
                selectedAgentId={selectedAgentId}
                selectedAgent={selectedAgent}
                onAgentSelect={setSelectedAgentId}
                ecosystemBridgeActive={ecosystemReturnState !== null}
                onReturnToEcosystem={handleReturnToEcosystem}
                agentInspectorTab={agentInspectorTab}
                onAgentInspectorTabChange={setAgentInspectorTab}
                contextPreset={contextPreset}
                onContextPresetChange={setContextPreset}
                effectiveConfig={effectiveConfig}
                effectiveLoading={effectiveLoading}
                effectiveError={effectiveError}
                unknownRate={unknownRate}
                selectedCapabilityId={selectedCapabilityId}
                onSelectCapability={handleSelectCapabilityInWorkspace}
                onCloseWhy={handleCloseWhy}
                explainData={explainData}
                explainLoading={explainLoading}
                explainError={explainError}
                observedById={observedById}
                observedSessionActive={observedSessionActive}
                observedDisclaimer={observedSession?.disclaimer}
                warningsScope={warningsScope}
                onWarningsScopeChange={setWarningsScope}
                displayedWarnings={displayedWarnings}
                allWarningsLoading={allWarningsLoading}
                allWarningsError={allWarningsError}
                editorPending={editorPending}
                editorPendingCount={selectedAgentEditorPendingCount}
                onToggleTool={handleToggleTool}
                onClearPending={handleClearPending}
              />
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
