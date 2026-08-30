import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const CORE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../src/core",
);

/**
 * Claude frontmatter field names, Claude env vars and the platform literal.
 * @see docs/SPEC.md §12.2, §13 invariant 1
 */
const BANNED = /(disallowedTools|permissionMode|initialPrompt|mcpServers|CLAUDE_CODE_|"claude")/;

/**
 * `ProjectSnapshot.mcpServers` is the discovery collection of MCP servers, not
 * an agent frontmatter field. MCP is protocol vocabulary core already speaks
 * (`ResolvedCapability.kind: "mcp_server" | "mcp_tool"`), so the name stays.
 */
const ALLOWED_LINES = new Set(["model/index.ts::  mcpServers: unknown[];"]);

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(full));
    } else if (entry.name.endsWith(".ts")) {
      files.push(full);
    }
  }
  return files.sort();
}

function coreLines(): Array<{ file: string; line: string }> {
  return collectSourceFiles(CORE_ROOT).flatMap((file) => {
    const relative = path.relative(CORE_ROOT, file).split(path.sep).join("/");
    return fs
      .readFileSync(file, "utf8")
      .split("\n")
      .map((line) => ({ file: relative, line }));
  });
}

function normalizeSourceLine(line: string): string {
  return line.replace(/\r$/, "");
}

describe("core platform independence", () => {
  it("contains no Claude frontmatter field, env var or platform literal", () => {
    const offenders = coreLines()
      .filter(({ file, line }) => {
        const normalized = normalizeSourceLine(line);
        return BANNED.test(normalized) && !ALLOWED_LINES.has(`${file}::${normalized}`);
      })
      .map(({ file, line }) => `${file}: ${normalizeSourceLine(line).trim()}`);

    expect(offenders).toEqual([]);
  });

  it("contains no .claude path and no platform version check", () => {
    const offenders = coreLines()
      .filter(({ line }) => line.includes(".claude/"))
      .map(({ file, line }) => `${file}: ${line.trim()}`);

    expect(offenders).toEqual([]);
  });

  it("never imports from an adapter", () => {
    const offenders = coreLines()
      .filter(({ line }) => /from "[^"]*adapters\//.test(line))
      .map(({ file, line }) => `${file}: ${line.trim()}`);

    expect(offenders).toEqual([]);
  });

  it("filters.ts branches on injected data, not tool-name literals", () => {
    const filters = fs.readFileSync(path.join(CORE_ROOT, "resolver/filters.ts"), "utf8");
    const branchLines = filters
      .split("\n")
      .filter((line) => /^\s*(if|\}\s*else if)\s*\(/.test(line) || /^\s*(&&|\|\|)/.test(line));

    for (const line of branchLines) {
      expect(line).not.toMatch(/"[A-Z][A-Za-z]*"/);
    }
  });
});
