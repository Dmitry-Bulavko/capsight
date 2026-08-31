import type {
  Agent,
  EffectiveConfiguration,
  SourceInfo,
  Warning,
} from "../../core/model/index.js";
import { formatSourceLine } from "./WarningsPanel.js";

export interface DeclaredEffectivePair {
  field: string;
  declared: string;
  effective: string;
  source?: SourceInfo;
  reason: string;
  matrixRef?: string;
  ineffective: boolean;
}

export interface ForkConfigurationNotice {
  message: string;
  matrixRef?: string;
}

const PERMISSION_MODE_DECLARED_RE =
  /^Declared permissionMode "([^"]+)" is not effective in this context\./;
const PLUGIN_FIELD_RE = /^Plugin agents ignore frontmatter (\w+)/;

function formatFactRef(matrixRef: string): string {
  if (matrixRef.startsWith("matrix://")) {
    return matrixRef;
  }
  return `[${matrixRef}]`;
}

function factRefFromWarning(warning: Warning): string | undefined {
  const fromMessage = /\(([A-Z]\d+)\)/.exec(warning.message);
  if (fromMessage) {
    return fromMessage[1];
  }
  return warning.matrixRef;
}

function formatDeclaredValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "unknown";
  }
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(String).join(", ");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function fieldFromEvidence(warning: Warning): string | undefined {
  const fieldPath = warning.evidence[0]?.fieldPath;
  if (!fieldPath?.startsWith("frontmatter.")) {
    return undefined;
  }
  return fieldPath.slice("frontmatter.".length);
}

function readAgentField(agent: Agent | null | undefined, field: string): unknown {
  if (!agent) {
    return undefined;
  }
  return (agent.configuration as unknown as Record<string, unknown>)[field];
}

function permissionCapability(effective: EffectiveConfiguration) {
  return effective.capabilities.find((capability) => capability.kind === "permission");
}

function effectivePermissionMode(effective: EffectiveConfiguration): string {
  const capability = permissionCapability(effective);
  if (!capability?.capabilityId.startsWith("permission:")) {
    return "unknown";
  }
  return capability.capabilityId.slice("permission:".length);
}

function permissionReason(effective: EffectiveConfiguration): {
  message?: string;
  matrixRef?: string;
} {
  const capability = permissionCapability(effective);
  if (!capability) {
    return {};
  }

  const reason = capability.reasons.find(
    (entry) =>
      entry.type === "parent-mode" ||
      entry.type === "context-filter" ||
      entry.matrixRef !== undefined,
  );

  return {
    message: reason?.message,
    matrixRef: reason?.matrixRef ?? capability.reasons.find((entry) => entry.matrixRef)?.matrixRef,
  };
}

export function extractForkNotice(
  effective: EffectiveConfiguration,
): ForkConfigurationNotice | null {
  if (!effective.context.isFork) {
    return null;
  }

  for (const capability of effective.capabilities) {
    for (const reason of capability.reasons) {
      if (
        reason.type === "context-filter" &&
        reason.message.includes("Fork inherits")
      ) {
        return {
          message:
            "Agent configuration (tools, disallowedTools, mcpServers, model, permissionMode) " +
            "does not apply in fork context. " +
            reason.message,
          matrixRef: reason.matrixRef,
        };
      }
    }
  }

  return {
    message:
      "Agent configuration (tools, disallowedTools, mcpServers, model, permissionMode) " +
      "does not apply in fork context.",
    matrixRef: undefined,
  };
}

export function extractDeclaredEffectivePairs(
  effective: EffectiveConfiguration,
  agent?: Agent | null,
): DeclaredEffectivePair[] {
  if (effective.context.isFork) {
    return [];
  }

  const ignoredWarnings = effective.warnings.filter(
    (warning) => warning.category === "ignored-field",
  );
  const pluginWarnings = ignoredWarnings.filter((warning) => PLUGIN_FIELD_RE.test(warning.message));
  const hasPluginPermissionMode = pluginWarnings.some(
    (warning) => fieldFromEvidence(warning) === "permissionMode",
  );

  const pairs: DeclaredEffectivePair[] = [];

  for (const warning of pluginWarnings) {
    const match = PLUGIN_FIELD_RE.exec(warning.message);
    const field = match?.[1] ?? fieldFromEvidence(warning);
    if (!field) {
      continue;
    }

    pairs.push({
      field,
      declared: formatDeclaredValue(readAgentField(agent, field)),
      effective: "—",
      source: warning.evidence[0],
      reason: warning.message,
      matrixRef: factRefFromWarning(warning),
      ineffective: true,
    });
  }

  const permissionWarning = ignoredWarnings.find(
    (warning) =>
      PERMISSION_MODE_DECLARED_RE.test(warning.message) && !hasPluginPermissionMode,
  );

  if (permissionWarning) {
    const match = PERMISSION_MODE_DECLARED_RE.exec(permissionWarning.message);
    const { message, matrixRef } = permissionReason(effective);

    pairs.push({
      field: "permissionMode",
      declared: match?.[1] ?? "unknown",
      effective: effectivePermissionMode(effective),
      source: permissionWarning.evidence[0],
      reason: message ?? permissionWarning.message,
      matrixRef: matrixRef ?? permissionWarning.matrixRef,
      ineffective: true,
    });
  }

  return pairs;
}

export function ForkConfigurationNoticeView({ notice }: { notice: ForkConfigurationNotice }) {
  return (
    <div className="fork-configuration-notice" role="note" data-testid="fork-configuration-notice">
      <p className="fork-configuration-message">⚠ {notice.message}</p>
      {notice.matrixRef && (
        <p className="declared-effective-fact-ref mono">{formatFactRef(notice.matrixRef)}</p>
      )}
    </div>
  );
}

function DeclaredEffectivePairView({ pair }: { pair: DeclaredEffectivePair }) {
  return (
    <article
      className={`declared-effective-pair${
        pair.ineffective ? " declared-effective-pair-ineffective" : ""
      }`}
    >
      <h3 className="declared-effective-field">{pair.field}</h3>
      <dl className="declared-effective-values">
        <div>
          <dt>Declared</dt>
          <dd>
            <code>{pair.declared}</code>
            {pair.source && (
              <span className="declared-effective-source mono">
                {" "}
                ({formatSourceLine(pair.source)})
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt>Effective</dt>
          <dd>
            <code>{pair.effective}</code>
          </dd>
        </div>
      </dl>
      {pair.ineffective && (
        <p className="declared-effective-warning">
          ⚠ Declared value is not effective in this context.
          <span className="declared-effective-reason"> {pair.reason}</span>
          {pair.matrixRef && (
            <span className="declared-effective-fact-ref mono">
              {" "}
              {formatFactRef(pair.matrixRef)}
            </span>
          )}
        </p>
      )}
    </article>
  );
}

interface DeclaredEffectivePanelProps {
  effective: EffectiveConfiguration | null;
  agent?: Agent | null;
  title?: string;
  showForkNotice?: boolean;
}

export function DeclaredEffectivePanel({
  effective,
  agent = null,
  title = "Declared vs effective",
  showForkNotice = false,
}: DeclaredEffectivePanelProps) {
  if (!effective) {
    return null;
  }

  const forkNotice = showForkNotice ? extractForkNotice(effective) : null;
  const pairs = extractDeclaredEffectivePairs(effective, agent);

  if (!forkNotice && pairs.length === 0) {
    return null;
  }

  return (
    <section className="declared-effective-panel" data-testid="declared-effective-panel">
      <h2>{title}</h2>
      {forkNotice && <ForkConfigurationNoticeView notice={forkNotice} />}
      {pairs.length > 0 && (
        <div className="declared-effective-list">
          {pairs.map((pair) => (
            <DeclaredEffectivePairView key={`${pair.field}-${pair.matrixRef ?? "default"}`} pair={pair} />
          ))}
        </div>
      )}
    </section>
  );
}
