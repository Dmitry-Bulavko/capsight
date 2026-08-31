import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type {
  Agent,
  EffectiveConfiguration,
  ExecutionContext,
  Warning,
} from "../../src/core/model/index.js";
import {
  DeclaredEffectivePanel,
  extractDeclaredEffectivePairs,
  extractForkNotice,
  ForkConfigurationNoticeView,
} from "../../src/ui/components/DeclaredEffective.js";

function makeContext(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    preset: "foreground-subagent",
    isMainSession: false,
    isBackground: false,
    isFork: false,
    isTeammate: false,
    depth: 0,
    maxDepth: 3,
    ...overrides,
  };
}

function makeEffective(overrides: Partial<EffectiveConfiguration> = {}): EffectiveConfiguration {
  return {
    agentId: "backend",
    context: makeContext(),
    version: {
      platform: "claude",
      version: "2.1.0",
      raw: "2.1.0",
      detectedAt: "2026-01-01T00:00:00.000Z",
    },
    capabilities: [],
    warnings: [],
    unknownRate: 0,
    ...overrides,
  };
}

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "backend",
    name: "backend",
    description: "Backend agent",
    source: {
      platform: "claude",
      scope: "project",
      path: ".claude/agents/backend.md",
    },
    status: "active",
    configuration: { unknownFields: {} },
    isPluginAgent: false,
    ...overrides,
  };
}

function makeWarning(overrides: Partial<Warning> = {}): Warning {
  return {
    category: "ignored-field",
    severity: "warning",
    message: 'Declared permissionMode "acceptEdits" is not effective in this context.',
    evidence: [
      {
        platform: "claude",
        scope: "project",
        path: ".claude/agents/backend.md",
        fieldPath: "frontmatter.permissionMode",
      },
    ],
    matrixRef: "P2",
    ignoredField: {
      field: "permissionMode",
      declared: "acceptEdits",
      effective: "auto",
      factRef: "P2",
    },
    ...overrides,
  };
}

describe("DeclaredEffective helpers", () => {
  it("extracts permissionMode declared/effective pair with P2 reason", () => {
    const effective = makeEffective({
      context: makeContext({ parentPermissionMode: "auto" }),
      capabilities: [
        {
          capabilityId: "permission:auto",
          kind: "permission",
          status: "available",
          enforcement: "enforced",
          sources: [
            {
              platform: "claude",
              scope: "project",
              path: ".claude/agents/backend.md",
            },
          ],
          reasons: [
            {
              type: "parent-mode",
              message:
                "Parent session is in auto mode; agent permissionMode frontmatter is ignored (P2).",
              source: {
                platform: "claude",
                scope: "project",
                path: ".claude/agents/backend.md",
                fieldPath: "frontmatter.permissionMode",
              },
              matrixRef: "P2",
            },
          ],
        },
      ],
      warnings: [makeWarning()],
    });

    const pairs = extractDeclaredEffectivePairs(effective);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({
      field: "permissionMode",
      declared: "acceptEdits",
      effective: "auto",
      matrixRef: "P2",
      ineffective: true,
    });
    expect(pairs[0]?.reason).toContain("auto mode");
  });

  it("extracts plugin agent ineffective fields with F9", () => {
    const effective = makeEffective({
      warnings: [
        makeWarning({
          message: "Plugin agents ignore frontmatter hooks (F9).",
          matrixRef: "agent.pluginFieldLimits",
          ignoredField: {
            field: "hooks",
            declared: '{"form":"object","events":["PreToolUse"],"count":1}',
            factRef: "F9",
          },
          evidence: [
            {
              platform: "claude",
              scope: "plugin",
              path: "plugins/my-plugin/agents/review/security.md",
              fieldPath: "frontmatter.hooks",
            },
          ],
        }),
        makeWarning({
          message: "Plugin agents ignore frontmatter permissionMode (F9).",
          matrixRef: "agent.pluginFieldLimits",
          ignoredField: {
            field: "permissionMode",
            declared: "bypassPermissions",
            factRef: "F9",
          },
          evidence: [
            {
              platform: "claude",
              scope: "plugin",
              path: "plugins/my-plugin/agents/review/security.md",
              fieldPath: "frontmatter.permissionMode",
            },
          ],
        }),
      ],
    });

    const agent = makeAgent({
      isPluginAgent: true,
      configuration: {
        permissionMode: "bypassPermissions",
        hooks: { form: "object", events: ["PreToolUse"], count: 1 },
        unknownFields: {},
      } as Agent["configuration"],
    });

    const pairs = extractDeclaredEffectivePairs(effective, agent);
    expect(pairs).toHaveLength(2);
    expect(pairs.map((pair) => pair.field).sort()).toEqual(["hooks", "permissionMode"]);
    expect(pairs.every((pair) => pair.matrixRef === "F9")).toBe(true);
    expect(pairs.every((pair) => pair.effective === "—")).toBe(true);
  });

  it("returns no pairs when the resolver did not report ignored fields", () => {
    const effective = makeEffective({
      capabilities: [
        {
          capabilityId: "permission:default",
          kind: "permission",
          status: "available",
          enforcement: "enforced",
          sources: [
            {
              platform: "claude",
              scope: "project",
              path: ".claude/agents/backend.md",
            },
          ],
          reasons: [],
        },
      ],
    });

    expect(extractDeclaredEffectivePairs(effective)).toEqual([]);
  });

  it("returns no field pairs in fork context and emits a T3 notice instead", () => {
    const effective = makeEffective({
      context: makeContext({ preset: "fork", isFork: true, isBackground: true }),
      capabilities: [
        {
          capabilityId: "Read",
          kind: "tool",
          status: "available",
          enforcement: "unknown",
          sources: [
            {
              platform: "claude",
              scope: "project",
              path: ".claude/agents/forked.md",
            },
          ],
          reasons: [
            {
              type: "context-filter",
              message:
                "Subagent fork context: agent tool filters do not apply to inherited pool.",
              source: {
                platform: "claude",
                scope: "project",
                path: ".claude/agents/forked.md",
              },
              matrixRef: "T3",
            },
          ],
        },
      ],
      warnings: [
        makeWarning({
          message: 'Declared permissionMode "acceptEdits" is not effective in this context.',
        }),
      ],
    });

    expect(extractDeclaredEffectivePairs(effective)).toEqual([]);
    expect(extractForkNotice(effective)).toMatchObject({
      matrixRef: "T3",
      message: "Subagent fork context: agent tool filters do not apply to inherited pool.",
    });
  });

  it("returns no fork notice when no T3 context-filter reason exists", () => {
    const effective = makeEffective({
      context: makeContext({ preset: "fork", isFork: true, isBackground: true }),
      capabilities: [
        {
          capabilityId: "Read",
          kind: "tool",
          status: "available",
          enforcement: "unknown",
          sources: [
            {
              platform: "claude",
              scope: "project",
              path: ".claude/agents/forked.md",
            },
          ],
          reasons: [
            {
              type: "context-filter",
              message: "Some other context filter without T3 matrix ref.",
              matrixRef: "T1",
            },
          ],
        },
      ],
    });

    expect(extractForkNotice(effective)).toBeNull();
  });

  it("returns no fork notice for T3 reasons that are not context-filter type", () => {
    const effective = makeEffective({
      context: makeContext({ preset: "fork", isFork: true, isBackground: true }),
      capabilities: [
        {
          capabilityId: "Read",
          kind: "tool",
          status: "available",
          enforcement: "unknown",
          sources: [
            {
              platform: "claude",
              scope: "project",
              path: ".claude/agents/forked.md",
            },
          ],
          reasons: [
            {
              type: "version",
              message: "Version-scoped reason tagged T3 but wrong type.",
              matrixRef: "T3",
            },
          ],
        },
      ],
    });

    expect(extractForkNotice(effective)).toBeNull();
  });

  it("ignores ignored-field warnings without structured ignoredField", () => {
    const effective = makeEffective({
      warnings: [
        makeWarning({
          ignoredField: undefined,
          message: 'Declared permissionMode "acceptEdits" is not effective in this context.',
        }),
      ],
    });

    expect(extractDeclaredEffectivePairs(effective)).toEqual([]);
  });
});

describe("DeclaredEffective components", () => {
  it("renders declared and effective values with fact reference", () => {
    const effective = makeEffective({
      capabilities: [
        {
          capabilityId: "permission:auto",
          kind: "permission",
          status: "available",
          enforcement: "enforced",
          sources: [
            {
              platform: "claude",
              scope: "project",
              path: ".claude/agents/backend.md",
            },
          ],
          reasons: [
            {
              type: "parent-mode",
              message:
                "Parent session is in auto mode; agent permissionMode frontmatter is ignored (P2).",
              matrixRef: "P2",
            },
          ],
        },
      ],
      warnings: [makeWarning()],
    });

    const html = renderToString(
      createElement(DeclaredEffectivePanel, {
        effective,
      }),
    );

    expect(html).toContain("permissionMode");
    expect(html).toContain("Declared");
    expect(html).toContain("acceptEdits");
    expect(html).toContain("Effective");
    expect(html).toContain("auto");
    expect(html).toContain("[P2]");
    expect(html).toContain("declared-effective-panel");
  });

  it("renders fork configuration notice with T3 reference", () => {
    const notice = {
      message: "Subagent fork context: agent tool filters do not apply to inherited pool.",
      matrixRef: "T3",
    };

    const html = renderToString(createElement(ForkConfigurationNoticeView, { notice }));

    expect(html).toContain(notice.message);
    expect(html).toContain("[T3]");
    expect(html).toContain("fork-configuration-notice");
  });
});
