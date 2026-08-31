import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Agent, AgentConfiguration } from "../../src/core/model/index.js";
import {
  AgentList,
  formatDeclaredStringList,
  formatHooksSummary,
  formatMcpServerEntry,
  formatUnknownFieldType,
  hasDeclaredConfiguration,
} from "../../src/ui/components/AgentList.js";

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "agent-1",
    name: "backend",
    description: "Backend agent",
    source: { platform: "claude", scope: "project", path: ".claude/agents/backend.md" },
    status: "active",
    configuration: { unknownFields: {} },
    isPluginAgent: false,
    ...overrides,
  };
}

function makeConfiguration(
  overrides: Record<string, unknown> & { unknownFields?: AgentConfiguration["unknownFields"] } = {},
): AgentConfiguration {
  const { unknownFields = {}, ...rest } = overrides;
  return { unknownFields, ...rest } as AgentConfiguration;
}

describe("formatDeclaredStringList", () => {
  it("distinguishes absent from empty collections", () => {
    expect(formatDeclaredStringList(undefined)).toEqual({ kind: "absent", text: "not declared" });
    expect(formatDeclaredStringList([])).toEqual({ kind: "empty", text: "empty" });
    expect(formatDeclaredStringList(["Read", "Write"])).toEqual({
      kind: "values",
      text: "Read, Write",
    });
  });
});

describe("formatMcpServerEntry", () => {
  it("shows structural MCP fields and key names only", () => {
    expect(formatMcpServerEntry("plugin-server")).toBe("plugin-server");
    expect(
      formatMcpServerEntry({
        name: "inline",
        transport: "stdio",
        commandName: "node",
        envKeys: ["API_TOKEN"],
        headerKeys: ["Authorization"],
      }),
    ).toBe(
      "inline · transport: stdio · command: node · env keys: API_TOKEN · header keys: Authorization",
    );
  });
});

describe("formatHooksSummary", () => {
  it("describes redacted hook structure", () => {
    expect(
      formatHooksSummary({ form: "object", events: ["PreToolUse"], count: 1 }),
    ).toBe("object — events: PreToolUse (1 hook group)");
  });
});

describe("hasDeclaredConfiguration", () => {
  it("detects when any declared field or unknown key is present", () => {
    expect(hasDeclaredConfiguration({ unknownFields: {} })).toBe(false);
    expect(hasDeclaredConfiguration({ unknownFields: {}, tools: [] } as AgentConfiguration)).toBe(true);
    expect(hasDeclaredConfiguration({ unknownFields: { customFlag: "boolean" } })).toBe(true);
  });
});

describe("AgentList markup", () => {
  it("renders declared tools, model, permissionMode and skills when present", () => {
    const html = renderToString(
      createElement(AgentList, {
        agents: [
          makeAgent({
            configuration: makeConfiguration({
              tools: ["Read", "Bash"],
              disallowedTools: [],
              model: "sonnet",
              permissionMode: "acceptEdits",
              skills: ["lint"],
            }),
          }),
        ],
      }),
    );

    expect(html).toContain("Read, Bash");
    expect(html).toContain("sonnet");
    expect(html).toContain("acceptEdits");
    expect(html).toContain("lint");
    expect(html).toContain('class="agent-config-empty"');
  });

  it("shows absent and empty collections with different markers", () => {
    const html = renderToString(
      createElement(AgentList, {
        agents: [
          makeAgent({
            name: "absent-tools",
            configuration: makeConfiguration({ tools: undefined, skills: ["lint"] }),
          }),
          makeAgent({
            id: "agent-2",
            name: "empty-tools",
            configuration: makeConfiguration({ tools: [], skills: undefined }),
          }),
        ],
      }),
    );

    expect(html).toContain('class="agent-config-absent"');
    expect(html).toContain("not declared");
    expect(html).toContain('class="agent-config-empty"');
    expect(html).toContain(">empty<");
  });

  it("keeps invalid, ambiguous and shadowed presentation and marks invalid config not in effect", () => {
    const html = renderToString(
      createElement(AgentList, {
        agents: [
          makeAgent({
            status: "invalid",
            invalidReason: "bad-yaml",
            configuration: makeConfiguration({ tools: ["Read"] }),
          }),
          makeAgent({
            id: "agent-2",
            name: "dup",
            status: "ambiguous",
            collision: { candidates: [], rule: "A4", matrixRef: "A4" },
            configuration: makeConfiguration({}),
          }),
          makeAgent({
            id: "agent-3",
            name: "old",
            status: "shadowed",
            collision: { candidates: [], rule: "A1", matrixRef: "A1" },
            configuration: makeConfiguration({}),
          }),
        ],
      }),
    );

    expect(html).toContain("Invalid: <code>bad-yaml</code>");
    expect(html).toContain("agent-declared-config--not-in-effect");
    expect(html).toContain("not in effect");
    expect(html).toContain("Name collision — no effective winner selected.");
    expect(html).toContain("Shadowed by another definition.");
  });

  it("shows unrecognized frontmatter keys by type", () => {
    const html = renderToString(
      createElement(AgentList, {
        agents: [
          makeAgent({
            configuration: makeConfiguration({
              unknownFields: { experimental: "boolean" },
            }),
          }),
        ],
      }),
    );

    expect(html).toContain("experimental");
    expect(html).toContain(formatUnknownFieldType("boolean"));
  });

  it("does not expose raw MCP env values", () => {
    const html = renderToString(
      createElement(AgentList, {
        agents: [
          makeAgent({
            configuration: makeConfiguration({
              mcpServers: [
                {
                  name: "inline",
                  transport: "stdio",
                  commandName: "node",
                  envKeys: ["SECRET_KEY"],
                  headerKeys: [],
                },
              ],
            }),
          }),
        ],
      }),
    );

    expect(html).toContain("env keys: SECRET_KEY");
    expect(html).not.toContain("super-secret-value");
    expect(html).not.toMatch(/SECRET_KEY=|SECRET_KEY":/);
  });
});
