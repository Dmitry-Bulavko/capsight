/**
 * Codex-specific domain types.
 * @see docs/CODEX-FACTS.md
 */

import type {
  Agent,
  AgentConfiguration,
  ProjectSnapshot,
  UnknownFieldType,
} from "../../../core/model/index.js";

export const CODEX_PLATFORM = "codex" as const;

export interface CodexAgentConfiguration extends AgentConfiguration {
  unknownFields: Record<string, UnknownFieldType>;
}

export type CodexAgent = Agent<CodexAgentConfiguration>;

export type CodexProjectSnapshot = ProjectSnapshot<CodexAgentConfiguration>;
