import type { PlatformId } from "../../adapters/platform.js";
import type { Agent, ContextPreset, EffectiveConfiguration } from "../../core/model/index.js";
import { agentPath } from "../format/agent-source.js";
import type { ObservedCapability } from "../../core/observed/index.js";
import type { EditorPendingState } from "../state/editor-store.js";
import { fetchExplain } from "../api.js";
import { DriftBanner } from "./DriftBanner.js";
import { AgentDeclaredConfiguration, SelectableAgentList } from "./AgentList.js";
import { AgentEditor } from "./AgentEditor.js";
import { AgentInspectorNav, type AgentInspectorTab } from "./AgentInspectorNav.js";
import { ContextPresetControl, ContextSelector } from "./ContextSelector.js";
import { DeclaredEffectivePanel } from "./DeclaredEffective.js";
import { EffectiveCapabilities } from "./EffectiveCapabilities.js";
import { GraphView } from "./GraphView.js";
import { WhyPanel } from "./WhyPanel.js";
import { WarningsPanel, type DisplayWarning, type WarningScope } from "./WarningsPanel.js";
import { STATUS_LABELS } from "./AgentSelector.js";

interface AgentsWorkspaceProps {
  platform: PlatformId;
  scanVersion: string;
  agents: Agent[];
  selectedAgentId: string | null;
  selectedAgent: Agent | null;
  onAgentSelect: (agentId: string) => void;
  ecosystemBridgeActive?: boolean;
  onReturnToEcosystem?: () => void;
  agentInspectorTab: AgentInspectorTab;
  onAgentInspectorTabChange: (tab: AgentInspectorTab) => void;
  contextPreset: ContextPreset;
  onContextPresetChange: (preset: ContextPreset) => void;
  effectiveConfig: EffectiveConfiguration | null;
  effectiveLoading: boolean;
  effectiveError: string | null;
  unknownRate: number | null;
  selectedCapabilityId: string | null;
  onSelectCapability: (capabilityId: string) => void;
  onCloseWhy: () => void;
  explainData: Awaited<ReturnType<typeof fetchExplain>> | null;
  explainLoading: boolean;
  explainError: string | null;
  observedById: Map<string, ObservedCapability> | null;
  observedSessionActive: boolean;
  observedDisclaimer?: string;
  warningsScope: WarningScope;
  onWarningsScopeChange: (scope: WarningScope) => void;
  displayedWarnings: DisplayWarning[];
  allWarningsLoading: boolean;
  allWarningsError: string | null;
  editorPending: EditorPendingState;
  editorPendingCount: number;
  onToggleTool: (toolName: string) => void;
  onClearPending: () => void;
}

function AgentOverview({ agent }: { agent: Agent }) {
  return (
    <div className="agent-inspector-overview">
      <header className="agent-inspector-overview-header">
        <h2>{agent.name}</h2>
        <span className={`status-badge status-${agent.status}`}>{STATUS_LABELS[agent.status]}</span>
      </header>
      <dl className="agent-meta">
        <div>
          <dt>Scope</dt>
          <dd>{agent.source.scope}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd className="mono truncate" title={agentPath(agent)}>
            {agentPath(agent)}
          </dd>
        </div>
      </dl>
      {agent.status === "invalid" && agent.invalidReason && (
        <p className="invalid-reason">
          Invalid: <code>{agent.invalidReason}</code>
        </p>
      )}
      {(agent.status === "ambiguous" || agent.status === "shadowed") && agent.collision && (
        <p className="collision-note">
          {agent.status === "ambiguous"
            ? "Name collision — no effective winner selected."
            : "Shadowed by another definition."}
          {agent.collision.rule && (
            <>
              {" "}
              <span className="collision-rule">({agent.collision.rule})</span>
            </>
          )}
        </p>
      )}
      <AgentDeclaredConfiguration agent={agent} />
    </div>
  );
}

export function AgentsWorkspace({
  platform,
  scanVersion,
  agents,
  selectedAgentId,
  selectedAgent,
  onAgentSelect,
  ecosystemBridgeActive = false,
  onReturnToEcosystem,
  agentInspectorTab,
  onAgentInspectorTabChange,
  contextPreset,
  onContextPresetChange,
  effectiveConfig,
  effectiveLoading,
  effectiveError,
  unknownRate,
  selectedCapabilityId,
  onSelectCapability,
  onCloseWhy,
  explainData,
  explainLoading,
  explainError,
  observedById,
  observedSessionActive,
  observedDisclaimer,
  warningsScope,
  onWarningsScopeChange,
  displayedWarnings,
  allWarningsLoading,
  allWarningsError,
  editorPending,
  editorPendingCount,
  onToggleTool,
  onClearPending,
}: AgentsWorkspaceProps) {
  const capabilitiesWithDetail =
    agentInspectorTab === "capabilities" && selectedCapabilityId !== null;
  const graphWithDetail = agentInspectorTab === "graph" && selectedCapabilityId !== null;

  return (
    <div className="agents-workspace" data-testid="agents-workspace">
      <div className="agents-workspace-grid">
        <aside className="agents-workspace-left panel" aria-label="Agent list">
          <ContextPresetControl
            preset={contextPreset}
            onPresetChange={onContextPresetChange}
            namePrefix="workspace-context-preset"
            compact
          />
          <SelectableAgentList
            agents={agents}
            selectedAgentId={selectedAgentId}
            onAgentSelect={onAgentSelect}
          />
        </aside>

        <section className="agents-workspace-right" aria-label="Agent inspector">
          <AgentInspectorNav
            activeTab={agentInspectorTab}
            onTabChange={onAgentInspectorTabChange}
            editorPendingCount={editorPendingCount}
          />

          <DriftBanner
            platform={platform}
            version={scanVersion}
            effective={effectiveConfig}
            loading={effectiveLoading}
            onSelectCapability={onSelectCapability}
          />

          <div
            className={`agents-workspace-content panel${
              capabilitiesWithDetail || graphWithDetail
                ? " agents-workspace-content--with-detail"
                : ""
            }`}
          >
            {agentInspectorTab === "overview" && (
              <>
                {!selectedAgent && (
                  <p className="empty-state">Select an agent to view declared configuration.</p>
                )}
                {selectedAgent && <AgentOverview agent={selectedAgent} />}
              </>
            )}

            {agentInspectorTab === "context" && (
              <ContextSelector
                preset={contextPreset}
                onPresetChange={onContextPresetChange}
                unknownRate={unknownRate}
                loading={effectiveLoading}
                error={effectiveError}
                hasSelectedAgent={selectedAgentId !== null}
                effective={effectiveConfig}
                agent={selectedAgent}
                showPresetSelector={false}
                showDeclaredEffective={false}
              />
            )}

            {agentInspectorTab === "capabilities" && (
              <>
                {!selectedAgentId && (
                  <p className="empty-state">Select an agent to view capabilities.</p>
                )}
                {selectedAgentId && (
                  <div
                    className={`tab-capabilities${
                      selectedCapabilityId ? " tab-capabilities--with-detail" : ""
                    }`}
                  >
                    {ecosystemBridgeActive && onReturnToEcosystem && (
                      <div
                        className="ecosystem-bridge-return-banner"
                        data-testid="ecosystem-bridge-return-banner"
                      >
                        <p>
                          Opened from declared inventory. Effective resolution — one context (
                          <code>{contextPreset}</code>).
                        </p>
                        <button type="button" onClick={onReturnToEcosystem}>
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
                      onSelectCapability={onSelectCapability}
                      warnings={effectiveConfig?.warnings ?? []}
                      observedById={observedById}
                      observedSessionActive={observedSessionActive}
                      observedDisclaimer={observedDisclaimer}
                    />
                    {selectedCapabilityId && (
                      <WhyPanel
                        explain={explainData}
                        loading={explainLoading}
                        error={explainError}
                        onClose={onCloseWhy}
                        observedById={observedById}
                        observedSessionActive={observedSessionActive}
                      />
                    )}
                  </div>
                )}
              </>
            )}

            {agentInspectorTab === "warnings" && (
              <div className="tab-warnings">
                <div className="warnings-scope-toggle" role="group" aria-label="Warning scope">
                  <button
                    type="button"
                    className={`warnings-scope-button${
                      warningsScope === "agent" ? " warnings-scope-button-active" : ""
                    }`}
                    disabled={!selectedAgentId}
                    onClick={() => onWarningsScopeChange("agent")}
                  >
                    Current agent
                  </button>
                  <button
                    type="button"
                    className={`warnings-scope-button${
                      warningsScope === "all" ? " warnings-scope-button-active" : ""
                    }`}
                    onClick={() => onWarningsScopeChange("all")}
                  >
                    All active agents
                  </button>
                </div>
                {warningsScope === "agent" && !selectedAgentId && (
                  <p className="empty-state">Select an agent to view warnings.</p>
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

            {agentInspectorTab === "graph" && (
              <div
                className={`tab-graph${selectedCapabilityId ? " tab-graph--with-detail" : ""}`}
              >
                <GraphView
                  context={contextPreset}
                  agentId={selectedAgentId ?? ""}
                  selectedCapabilityId={selectedCapabilityId}
                  onSelectCapability={onSelectCapability}
                />
                {selectedCapabilityId && selectedAgentId && (
                  <WhyPanel
                    explain={explainData}
                    loading={explainLoading}
                    error={explainError}
                    onClose={onCloseWhy}
                    observedById={observedById}
                    observedSessionActive={observedSessionActive}
                  />
                )}
              </div>
            )}

            {agentInspectorTab === "editor" && (
              <>
                {!selectedAgent && (
                  <p className="empty-state">Select an agent to edit tools.</p>
                )}
                {selectedAgent && (
                  <AgentEditor
                    agent={selectedAgent}
                    effective={effectiveConfig}
                    effectiveLoading={effectiveLoading}
                    pending={editorPending}
                    onToggleTool={onToggleTool}
                    onClearPending={onClearPending}
                  />
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
