import type {
  ExecutionContext,
  ResolutionReason,
  SourceInfo,
} from "../../../core/model/index.js";
import type {
  ClaudeAgent as Agent,
  PermissionMode,
} from "../model/index.js";
import { FACT, type FactId } from "../version/facts.js";

/** Effective permissions settings relevant to resolution (P4). */
export interface PermissionSettings {
  disableBypassPermissionsMode?: boolean;
  /** Layer the value was taken from — the highest-priority one that sets it (S1). */
  disableBypassPermissionsModeSource?: SourceInfo;
  /**
   * `true` when settings layers disagree on the value, so the outcome rests on
   * the S1 layer order rather than on a single declaration.
   */
  layerPrecedenceDecided?: boolean;
}

export interface ResolvePermissionModeResult {
  declared?: PermissionMode;
  effective: PermissionMode;
  ineffective: boolean;
  reasons: ResolutionReason[];
}

function permissionModeSource(agentSource: SourceInfo): SourceInfo {
  return { ...agentSource, fieldPath: "frontmatter.permissionMode" };
}

function makeReason(
  type: ResolutionReason["type"],
  message: string,
  source?: SourceInfo,
  matrixRef?: FactId,
): ResolutionReason {
  return matrixRef
    ? { type, message, source, matrixRef }
    : source
      ? { type, message, source }
      : { type, message };
}

/**
 * Resolve declared vs effective permissionMode for an agent in context.
 * @see docs/SPEC.md P1, P2, P4, §4.4
 */
export function resolvePermissionMode(
  agent: Agent,
  context: ExecutionContext,
  settings: PermissionSettings = {},
): ResolvePermissionModeResult {
  const declared = agent.configuration.permissionMode;
  const reasons: ResolutionReason[] = [];
  const agentSource = agent.source;
  // Core carries the parent mode as an opaque platform string (§12.2).
  const parentMode = context.parentPermissionMode as PermissionMode | undefined;

  if (context.isFork) {
    const effective = parentMode ?? "default";
    if (declared !== undefined) {
      reasons.push(
        makeReason(
          "context-filter",
          "Agent permissionMode not applied in fork context (T3).",
          agentSource,
        ),
      );
    } else {
      reasons.push(
        makeReason(
          "inherited",
          "Fork inherits parent session permission mode (T3).",
          agentSource,
        ),
      );
    }
    return {
      declared,
      effective,
      ineffective: declared !== undefined,
      reasons,
    };
  }

  if (parentMode === "bypassPermissions" || parentMode === "acceptEdits") {
    if (declared !== undefined) {
      reasons.push(
        makeReason(
          "parent-mode",
          `Parent session permission mode "${parentMode}" takes precedence; agent frontmatter ignored (P1).`,
          permissionModeSource(agentSource),
          FACT.P1,
        ),
      );
    } else {
      reasons.push(
        makeReason(
          "inherited",
          `Inherited parent session permission mode "${parentMode}" (P1).`,
          agentSource,
          FACT.P1,
        ),
      );
    }
    return {
      declared,
      effective: parentMode,
      ineffective: declared !== undefined,
      reasons,
    };
  }

  if (parentMode === "auto") {
    if (declared !== undefined) {
      reasons.push(
        makeReason(
          "parent-mode",
          "Parent session is in auto mode; agent permissionMode frontmatter is ignored (P2).",
          permissionModeSource(agentSource),
          FACT.P2,
        ),
      );
    } else {
      reasons.push(
        makeReason(
          "inherited",
          "Inherited auto permission mode from parent session (P2).",
          agentSource,
          FACT.P2,
        ),
      );
    }
    return {
      declared,
      effective: "auto",
      ineffective: declared !== undefined,
      reasons,
    };
  }

  if (
    declared === "bypassPermissions" &&
    settings.disableBypassPermissionsMode === true
  ) {
    const effective = parentMode ?? "default";
    reasons.push(
      makeReason(
        "denied",
        "bypassPermissions in agent frontmatter ignored because permissions.disableBypassPermissionsMode is set (P4).",
        permissionModeSource(agentSource),
        FACT.P4,
      ),
    );
    if (settings.disableBypassPermissionsModeSource) {
      // Which layer supplied the value is a claim of its own once layers
      // disagree, so it is stated with its source rather than folded silently
      // into the P4 verdict (S1).
      reasons.push({
        type: "declared",
        message: settings.layerPrecedenceDecided
          ? "Settings layers disagree on permissions.disableBypassPermissionsMode; the value comes from the highest-priority layer that sets it (S1). See this reason's source."
          : "permissions.disableBypassPermissionsMode is set by the settings layer named in this reason's source (S1).",
        source: settings.disableBypassPermissionsModeSource,
        matrixRef: "settings.layerPrecedence",
      });
    }
    return {
      declared,
      effective,
      ineffective: true,
      reasons,
    };
  }

  if (declared !== undefined) {
    reasons.push(
      makeReason(
        "declared",
        `Effective permission mode from agent frontmatter "${declared}" (P5).`,
        permissionModeSource(agentSource),
      ),
    );
    return {
      declared,
      effective: declared,
      ineffective: false,
      reasons,
    };
  }

  const effective = parentMode ?? "default";
  reasons.push(
    parentMode !== undefined
      ? makeReason(
          "inherited",
          `Inherited permission mode "${effective}" from parent session.`,
          agentSource,
        )
      : makeReason(
          "inherited",
          'No permissionMode declared; using default (manual) mode (P5).',
          agentSource,
        ),
  );

  return {
    declared,
    effective,
    ineffective: false,
    reasons,
  };
}
