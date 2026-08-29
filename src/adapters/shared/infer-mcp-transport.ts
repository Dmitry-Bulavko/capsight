export type McpTransportKind = "stdio" | "sse" | "ws" | "http" | "unknown";

const KNOWN_TRANSPORT_TYPES = new Set<McpTransportKind>(["stdio", "sse", "ws", "http"]);

/** Infer MCP transport from a config record (shared by cursor/codex adapters). */
export function inferMcpTransport(config: Record<string, unknown>): McpTransportKind {
  if (typeof config.type === "string") {
    const type = config.type.toLowerCase() as McpTransportKind;
    if (KNOWN_TRANSPORT_TYPES.has(type)) {
      return type;
    }
  }
  if (typeof config.command === "string") {
    return "stdio";
  }
  if (typeof config.url === "string") {
    const url = config.url.toLowerCase();
    if (/\/sse(?:\/|$|\?|#)/.test(url)) {
      return "sse";
    }
    if (url.startsWith("ws")) {
      return "ws";
    }
    return "http";
  }
  return "unknown";
}
