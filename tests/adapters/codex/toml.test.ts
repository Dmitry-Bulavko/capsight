import { describe, expect, it } from "vitest";
import { parseToml } from "../../../src/adapters/codex/parsing/toml.js";

describe("parseToml", () => {
  it("parses multiline arrays", () => {
    const parsed = parseToml(`
[mcp_servers.example]
command = "npx"
args = [
  "-y",
  "@modelcontextprotocol/server-example",
]

project_doc_fallback_filenames = [
  "CLAUDE.md",
  "AGENTS.md",
]
`);

    const server = (parsed.mcp_servers as Record<string, unknown>).example as Record<
      string,
      unknown
    >;
    expect(server.args).toEqual(["-y", "@modelcontextprotocol/server-example"]);
    expect(server.project_doc_fallback_filenames).toEqual(["CLAUDE.md", "AGENTS.md"]);
  });
});
