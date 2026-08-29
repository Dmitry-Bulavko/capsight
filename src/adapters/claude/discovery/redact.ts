import path from "node:path";
import type { UnknownFieldType } from "../../../core/model/index.js";
import type {
  HooksSummary,
  RedactedMcpServer,
} from "../model/index.js";

/**
 * Redaction boundary for agent frontmatter values that can carry credentials.
 * Discovery never stores raw `mcpServers`, `hooks` or unknown-field values:
 * key names, types and structural counts only.
 * @see docs/SPEC.md §0.1.8, §12.6, §13 invariant 10
 */

function sortedKeys(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }
  return Object.keys(value as Record<string, unknown>).sort();
}

function inferTransport(config: Record<string, unknown>): RedactedMcpServer["transport"] {
  if (typeof config.command === "string") {
    return "stdio";
  }
  if (typeof config.url === "string") {
    const url = config.url.toLowerCase();
    if (url.includes("sse")) {
      return "sse";
    }
    if (url.startsWith("ws")) {
      return "ws";
    }
    return "http";
  }
  return "unknown";
}

/** Executable name without directory or arguments (a URL or arg may carry a token). */
function commandName(config: Record<string, unknown>): string | undefined {
  if (typeof config.command !== "string" || config.command.length === 0) {
    return undefined;
  }
  const normalized = config.command.replace(/\\/g, "/");
  return path.posix.basename(normalized) || undefined;
}

function redactMcpServerEntry(entry: unknown): string | RedactedMcpServer {
  if (typeof entry === "string") {
    return entry;
  }
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return { transport: "unknown", envKeys: [], headerKeys: [] };
  }

  const config = entry as Record<string, unknown>;
  const name = typeof config.name === "string" ? config.name : undefined;
  const command = commandName(config);

  return {
    ...(name !== undefined ? { name } : {}),
    transport: inferTransport(config),
    ...(command !== undefined ? { commandName: command } : {}),
    envKeys: sortedKeys(config.env),
    headerKeys: sortedKeys(config.headers),
  };
}

/** Reduce frontmatter `mcpServers` to named references plus redacted inline definitions. */
export function redactMcpServers(
  value: unknown,
): Array<string | RedactedMcpServer> | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.map(redactMcpServerEntry);
}

/** Reduce frontmatter `hooks` to a structural summary — no commands, no arguments. */
export function summarizeHooks(value: unknown): HooksSummary | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return { form: "array", events: [], count: value.length };
  }
  if (typeof value === "object") {
    const events = Object.keys(value as Record<string, unknown>).sort();
    return { form: "object", events, count: events.length };
  }
  return { form: "scalar", events: [], count: 0 };
}

export function describeValueType(value: unknown): UnknownFieldType {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  switch (typeof value) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "object":
      return "object";
    default:
      return "unknown";
  }
}

/**
 * Collect unrecognized frontmatter keys with their value types (§8.2).
 * Field names are retained so the `Unrecognized field` warning stays useful;
 * values never are.
 */
export function redactUnknownFields(
  data: Record<string, unknown>,
  knownKeys: ReadonlySet<string>,
): Record<string, UnknownFieldType> {
  const unknownFields: Record<string, UnknownFieldType> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!knownKeys.has(key)) {
      unknownFields[key] = describeValueType(value);
    }
  }
  return unknownFields;
}
