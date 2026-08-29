import { describe, expect, it } from "vitest";
import { inferMcpTransport } from "../../../src/adapters/shared/infer-mcp-transport.js";

describe("inferMcpTransport", () => {
  it("prefers explicit type field", () => {
    expect(inferMcpTransport({ type: "sse", url: "https://example.com/mcp" })).toBe("sse");
  });

  it("detects stdio from command", () => {
    expect(inferMcpTransport({ command: "npx" })).toBe("stdio");
  });

  it("detects SSE from URL path segment", () => {
    expect(inferMcpTransport({ url: "https://example.com/mcp/sse" })).toBe("sse");
  });

  it("does not treat assessment paths as SSE", () => {
    expect(inferMcpTransport({ url: "https://example.com/assessment/mcp" })).toBe("http");
  });

  it("detects websocket URLs", () => {
    expect(inferMcpTransport({ url: "wss://example.com/mcp" })).toBe("ws");
  });
});
