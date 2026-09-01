import { VERSION_MATRIX as CLAUDE_MATRIX } from "../adapters/claude/version/matrix.js";
import { VERSION_MATRIX as CODEX_MATRIX } from "../adapters/codex/version/matrix.js";
import { VERSION_MATRIX as CURSOR_MATRIX } from "../adapters/cursor/version/matrix.js";

export type MatrixConfidence = "doc" | "fixture" | "runtime-observed";

export interface MatrixEntryLike {
  id: string;
  confidence: MatrixConfidence;
  feature: string;
}

const ALL_MATRIX_ENTRIES: MatrixEntryLike[] = [
  ...CLAUDE_MATRIX,
  ...CURSOR_MATRIX,
  ...CODEX_MATRIX,
];

export const MATRIX_ENTRY_BY_ID = new Map<string, MatrixEntryLike>(
  ALL_MATRIX_ENTRIES.map((entry) => [entry.id, entry]),
);

export const MATRIX_FEATURE_BY_ID = new Map<string, string>(
  ALL_MATRIX_ENTRIES.map((entry) => [entry.id, entry.feature]),
);
