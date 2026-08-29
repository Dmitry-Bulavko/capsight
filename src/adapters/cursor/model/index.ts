/**
 * Cursor-specific domain types.
 * @see docs/CURSOR-FACTS.md
 */

import type {
  Agent,
  AgentConfiguration,
  ProjectSnapshot,
  UnknownFieldType,
} from "../../../core/model/index.js";

export const CURSOR_PLATFORM = "cursor" as const;

export interface CursorAgentConfiguration extends AgentConfiguration {
  tools?: string[];
  model?: string;
  unknownFields: Record<string, UnknownFieldType>;
}

export type CursorAgent = Agent<CursorAgentConfiguration>;

export type CursorProjectSnapshot = ProjectSnapshot<CursorAgentConfiguration>;
