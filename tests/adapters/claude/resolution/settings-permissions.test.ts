import { describe, expect, it } from "vitest";
import type { ResolvedCapability } from "../../../../src/core/model/index.js";
import type { SettingsLayer } from "../../../../src/adapters/claude/discovery/types.js";
import { parseSettingsPermissions } from "../../../../src/adapters/claude/discovery/settings.js";
import {
  parseSettingsPermissionRule,
  resolveDisableBypassPermissionsMode,
  resolveProjectMcpApproval,
  resolveSettingsKeys,
  resolveSettingsPermissions,
} from "../../../../src/adapters/claude/resolution/settings-permissions.js";

const VERSION = "2.1.240";

function layer(
  scope: SettingsLayer["scope"],
  priority: number,
  permissions: Record<string, unknown>,
): SettingsLayer {
  const parsed = parseSettingsPermissions({ permissions });
  return {
    scope,
    path: `/project/.claude/${scope}.json`,
    priority,
    ...(parsed ? { permissions: parsed } : {}),
  };
}

function availableTool(capabilityId: string): ResolvedCapability {
  return {
    capabilityId,
    kind: "tool",
    status: "available",
    enforcement: "enforced",
    sources: [{ platform: "claude", scope: "project", path: "/project/a.md" }],
    reasons: [
      { type: "declared", message: `Allowed by tools pattern "${capabilityId}" (F2).` },
    ],
  };
}

function ruleCapability(
  result: ReturnType<typeof resolveSettingsPermissions>,
  suffix: string,
): ResolvedCapability | undefined {
  return result.ruleCapabilities.find((capability) =>
    capability.capabilityId.endsWith(suffix),
  );
}

describe("settings permission rule syntax", () => {
  it("recognizes the shapes §3.5 describes", () => {
    expect(parseSettingsPermissionRule("Bash")).toEqual({
      kind: "bare-tool",
      tool: "Bash",
    });
    expect(parseSettingsPermissionRule("Bash(npm run test:*)")).toEqual({
      kind: "scoped",
      tool: "Bash",
      argument: "npm run test:*",
    });
    expect(parseSettingsPermissionRule("Read(/src/**)")).toMatchObject({
      kind: "scoped",
      tool: "Read",
    });
    expect(parseSettingsPermissionRule("WebFetch(domain:example.com)")).toMatchObject({
      kind: "scoped",
      tool: "WebFetch",
    });
    expect(parseSettingsPermissionRule("mcp__github__issues")).toEqual({
      kind: "mcp",
      raw: "mcp__github__issues",
    });
    expect(parseSettingsPermissionRule("*")).toEqual({ kind: "unanchored-glob" });
    expect(parseSettingsPermissionRule("mcp__*")).toEqual({ kind: "unanchored-glob" });
  });

  it("names the invalid shapes instead of dropping them (S3, S8)", () => {
    expect(parseSettingsPermissionRule("mcp__github(issues)")).toEqual({
      kind: "invalid-mcp-bracket",
    });
    expect(parseSettingsPermissionRule("WebFetch(example.org)")).toEqual({
      kind: "webfetch-no-domain",
    });
    expect(parseSettingsPermissionRule("Bash(")).toEqual({ kind: "unrecognized" });
    // S3 lists three bracket-free forms; a wildcard anywhere else is not one.
    expect(parseSettingsPermissionRule("mcp__github__*")).toEqual({
      kind: "mcp",
      raw: "mcp__github__*",
    });
    expect(parseSettingsPermissionRule("mcp__github*")).toEqual({
      kind: "unrecognized",
    });
    expect(parseSettingsPermissionRule("mcp__github__issues__extra")).toEqual({
      kind: "unrecognized",
    });
    expect(parseSettingsPermissionRule("Nope")).toEqual({
      kind: "bare-unknown",
      name: "Nope",
    });
  });
});

describe("resolveDisableBypassPermissionsMode (S1)", () => {
  it("takes the value from the highest-priority layer that sets it", () => {
    const resolved = resolveDisableBypassPermissionsMode([
      layer("project", 30, { disableBypassPermissionsMode: false }),
      layer("local", 35, { disableBypassPermissionsMode: true }),
    ]);

    expect(resolved).toMatchObject({ value: true, contested: true });
    expect(resolved.source?.scope).toBe("local");
  });

  it("does not let a lower layer lift a higher one either way", () => {
    const resolved = resolveDisableBypassPermissionsMode([
      layer("project", 30, { disableBypassPermissionsMode: true }),
      layer("local", 35, { disableBypassPermissionsMode: false }),
    ]);

    expect(resolved).toMatchObject({ value: false, contested: true });
    expect(resolved.source?.scope).toBe("local");
  });

  it("reports nothing when no layer sets the key", () => {
    expect(
      resolveDisableBypassPermissionsMode([layer("project", 30, { allow: ["Read"] })]),
    ).toEqual({ contested: false });
  });
});

describe("S11 settings keys", () => {
  function mcpLayer(
    scope: SettingsLayer["scope"],
    priority: number,
    value?: boolean,
  ): SettingsLayer {
    return {
      scope,
      path: `/project/.claude/${scope}.json`,
      priority,
      ...(value !== undefined ? { enableAllProjectMcpServers: value } : {}),
    };
  }

  const directoryCapabilities = (layers: SettingsLayer[]): ResolvedCapability[] =>
    resolveSettingsKeys(layers, VERSION).filter((capability) =>
      capability.capabilityId.startsWith("settings-additional-directory:"),
    );

  it("reports each additionalDirectories entry with its own source (S11)", () => {
    const capabilities = directoryCapabilities([
      layer("project", 30, {
        additionalDirectories: ["/opt/shared-docs", "../vendor-lib"],
      }),
    ]);

    expect(capabilities.map((capability) => capability.capabilityId)).toEqual([
      "settings-additional-directory:project:/opt/shared-docs",
      "settings-additional-directory:project:../vendor-lib",
    ]);
    for (const capability of capabilities) {
      // The evidence the matrix entry claims: without this rule the file-access
      // surface the settings widen is absent from the reported set entirely.
      expect(capability.status).toBe("available");
      expect(capability.enforcement).toBe("enforced");
      expect(capability.sources[0]?.path).toBe("/project/.claude/project.json");
      expect(capability.reasons[0]?.matrixRef).toBe("settings.additionalDirectories");
    }
    // The entry text is not resolved against anything (§3.5 says nothing about it).
    expect(capabilities[1]?.reasons[0]?.message).toContain('"../vendor-lib"');
  });

  it("leaves two layers declaring the key undetermined rather than merging them", () => {
    const capabilities = directoryCapabilities([
      layer("project", 30, { additionalDirectories: ["/opt/a"] }),
      layer("local", 35, { additionalDirectories: ["/opt/b"] }),
    ]);

    expect(capabilities).toHaveLength(2);
    for (const capability of capabilities) {
      expect(capability.status).toBe("unknown");
      expect(capability.enforcement).toBe("unknown");
      expect(capability.reasons[0]?.message).toMatch(/does not state whether/);
    }
  });

  it("takes enableAllProjectMcpServers from the highest-priority layer that sets it (S1)", () => {
    expect(
      resolveProjectMcpApproval([
        mcpLayer("project", 30, false),
        mcpLayer("local", 35, true),
      ]),
    ).toMatchObject({ value: true, contested: true });
    expect(resolveProjectMcpApproval([mcpLayer("project", 30)])).toBeUndefined();
  });

  it("reports project MCP servers as approved without a prompt when the key is true", () => {
    const [capability] = resolveSettingsKeys([mcpLayer("project", 30, true)], VERSION);

    expect(capability).toMatchObject({
      capabilityId: "settings-project-mcp-approval",
      status: "available",
      enforcement: "enforced",
    });
    expect(capability!.reasons[0]?.message).toContain("approved without a prompt");
    // The trust interaction is founded on §7.2/R4, not assumed: a project with
    // no accepted trust record does not withhold this approval, and the
    // capability says so instead of leaving the reader to guess.
    const trustReason = capability!.reasons.find((entry) => entry.type === "trust");
    expect(trustReason?.message).toMatch(
      /servers declared in \.mcp\.json load without a trust check \(R4\)/,
    );
    // §7.2 is what limits the scope of blocked_by_trust; R4 is the separate
    // list of what loads without a trust check. Each proposition cites the
    // rule that founds it, so a reader chasing the reference finds it there.
    expect(trustReason?.message).toContain("§7.2 limits blocked_by_trust");
  });

  it("does not read a false value as the opposite claim", () => {
    const [capability] = resolveSettingsKeys([mcpLayer("project", 30, false)], VERSION);

    expect(capability).toMatchObject({
      capabilityId: "settings-project-mcp-approval",
      status: "unknown",
      enforcement: "unknown",
    });
    expect(capability!.reasons[0]?.message).toMatch(/not what a false value leaves in place/);
  });

  it("claims no security boundary for either key (§2.4)", () => {
    const messages = resolveSettingsKeys(
      [
        layer("project", 30, { additionalDirectories: ["/opt/shared-docs"] }),
        mcpLayer("local", 35, true),
      ],
      VERSION,
    ).flatMap((capability) => capability.reasons.map((entry) => entry.message));

    expect(messages.length).toBeGreaterThan(0);
    for (const message of messages) {
      expect(message).not.toMatch(/sandbox|cannot access|is trusted|are trusted/i);
    }
  });
});

describe("resolveSettingsPermissions", () => {
  it("denies a tool the frontmatter permits (S2, S5)", () => {
    // The §6 archetype: without this stage the tool is reported available and
    // enforced, which is a confident wrong answer in the dangerous direction.
    const result = resolveSettingsPermissions({
      layers: [layer("project", 30, { deny: ["Bash"] })],
      capabilities: [availableTool("Bash"), availableTool("Read")],
      version: VERSION,
    });

    const bash = result.capabilities.find(
      (capability) => capability.capabilityId === "Bash",
    );
    expect(bash).toMatchObject({ status: "denied", enforcement: "enforced" });
    expect(bash?.reasons.at(-1)?.matrixRef).toBe("settings.denyBareTool");
    // The earlier verdict stays visible next to the one that overrode it.
    expect(bash?.reasons).toHaveLength(2);
    expect(
      result.capabilities.find((capability) => capability.capabilityId === "Read"),
    ).toMatchObject({ status: "available" });
  });

  it("is not overridden by an allow in a higher-priority layer (S1, S2)", () => {
    const result = resolveSettingsPermissions({
      layers: [
        layer("project", 30, { deny: ["Write"] }),
        layer("local", 35, { allow: ["Write"] }),
      ],
      capabilities: [availableTool("Write")],
      version: VERSION,
    });

    expect(
      result.capabilities.find((capability) => capability.capabilityId === "Write"),
    ).toMatchObject({ status: "denied", enforcement: "enforced" });
    expect(ruleCapability(result, "allow:Write")).toMatchObject({
      status: "blocked",
      enforcement: "enforced",
    });
    expect(ruleCapability(result, "allow:Write")?.reasons[0]?.matrixRef).toBe(
      "settings.denyPrecedence",
    );
  });

  it("denies a tool the fork context inherited unresolved (S2)", () => {
    const inherited: ResolvedCapability = {
      ...availableTool("Bash"),
      enforcement: "unknown",
    };
    const result = resolveSettingsPermissions({
      layers: [layer("project", 30, { deny: ["Bash"] })],
      capabilities: [inherited],
      version: VERSION,
    });

    expect(
      result.capabilities.find((capability) => capability.capabilityId === "Bash"),
    ).toMatchObject({ status: "denied", enforcement: "enforced" });
  });

  it("records a denied tool that was not in the pool at all", () => {
    const result = resolveSettingsPermissions({
      layers: [layer("project", 30, { deny: ["Bash"] })],
      capabilities: [],
      version: VERSION,
    });

    expect(result.capabilities).toHaveLength(1);
    expect(result.capabilities[0]).toMatchObject({
      capabilityId: "Bash",
      status: "denied",
    });
  });

  it("reports an unanchored allow glob as granting nothing (S4)", () => {
    const result = resolveSettingsPermissions({
      layers: [layer("project", 30, { allow: ["*", "mcp__*"] })],
      capabilities: [],
      version: VERSION,
    });

    for (const suffix of ["allow:*", "allow:mcp__*"]) {
      expect(ruleCapability(result, suffix)).toMatchObject({
        status: "blocked",
        enforcement: "enforced",
      });
    }
  });

  it("reports an invalid MCP allow rule as granting nothing (S3)", () => {
    const result = resolveSettingsPermissions({
      layers: [layer("project", 30, { allow: ["mcp__github(issues)"] })],
      capabilities: [],
      version: VERSION,
    });

    expect(ruleCapability(result, "mcp__github(issues)")).toMatchObject({
      status: "blocked",
      enforcement: "enforced",
    });
  });

  it("never calls a deny rule inert on a syntax argument (§13 invariant 14)", () => {
    // S3 and S8 say which syntax is required, not what the platform does with
    // a deny rule that omits it. Reporting such a rule as ineffective would be
    // a confident claim in the dangerous direction.
    const result = resolveSettingsPermissions({
      layers: [
        layer("project", 30, {
          deny: ["mcp__github(issues)", "WebFetch(example.org)"],
        }),
      ],
      capabilities: [],
      version: VERSION,
    });

    for (const suffix of ["mcp__github(issues)", "WebFetch(example.org)"]) {
      expect(ruleCapability(result, suffix)).toMatchObject({
        status: "unknown",
        enforcement: "unknown",
      });
    }
  });

  it("leaves an argument-scoped rule unknown without touching the tool", () => {
    const result = resolveSettingsPermissions({
      layers: [layer("project", 30, { deny: ["Edit(//etc/secrets/**)"] })],
      capabilities: [availableTool("Edit")],
      version: VERSION,
    });

    expect(ruleCapability(result, "Edit(//etc/secrets/**)")).toMatchObject({
      status: "unknown",
      enforcement: "unknown",
    });
    // The rule narrows invocations, not the tool: Edit is still in the session.
    expect(
      result.capabilities.find((capability) => capability.capabilityId === "Edit"),
    ).toMatchObject({ status: "available" });
  });

  it("attributes Bash(...) rules to S6 via settings.bashPrefixRules", () => {
    const result = resolveSettingsPermissions({
      layers: [layer("project", 30, { allow: ["Bash(npm run test:*)"] })],
      capabilities: [availableTool("Bash")],
      version: VERSION,
    });

    const rule = ruleCapability(result, "allow:Bash(npm run test:*)");
    expect(rule?.reasons[0]?.matrixRef).toBe("settings.bashPrefixRules");
    expect(rule?.reasons[0]?.message).not.toMatch(/S6 documents Bash.*only/);
  });

  it("does not attribute PowerShell(...) rules to S6 (settings.bashPrefixRules)", () => {
    const result = resolveSettingsPermissions({
      layers: [layer("project", 30, { allow: ["PowerShell(Get-Process:*)"] })],
      capabilities: [availableTool("PowerShell")],
      version: VERSION,
    });

    const rule = ruleCapability(result, "allow:PowerShell(Get-Process:*)");
    expect(rule?.reasons[0]?.matrixRef).toBe("settings.ruleScope");
    expect(rule?.reasons[0]?.matrixRef).not.toBe("settings.bashPrefixRules");
    expect(rule?.reasons[0]?.message).toMatch(
      /S6 documents Bash\(cmd:\*\) prefix matching only and does not cover PowerShell/,
    );
  });

  it("gives every rule a capability, including ones it cannot act on", () => {
    const result = resolveSettingsPermissions({
      layers: [
        layer("project", 30, {
          allow: ["Read(/src/**)", "Nonsense((("],
          deny: ["Bash"],
          ask: ["Write"],
        }),
      ],
      capabilities: [],
      version: VERSION,
    });

    // Four rules in, four rule capabilities out — an unimplemented rule is a
    // visible `unknown`, never an absent line.
    expect(result.ruleCapabilities).toHaveLength(4);
    expect(
      result.ruleCapabilities.every((capability) => capability.kind === "permission"),
    ).toBe(true);
    expect(ruleCapability(result, "Nonsense(((")).toMatchObject({
      status: "unknown",
      enforcement: "unknown",
    });
    expect(ruleCapability(result, "ask:Write")).toMatchObject({
      status: "unknown",
      enforcement: "unknown",
    });
  });

  it("never leaves an MCP tool a deny rule names reported as available (S2, S3)", () => {
    const mcpTool: ResolvedCapability = {
      ...availableTool("mcp__github__issues"),
      kind: "mcp_tool",
    };
    const otherServer: ResolvedCapability = {
      ...availableTool("mcp__linear__list"),
      kind: "mcp_tool",
    };
    const result = resolveSettingsPermissions({
      layers: [layer("project", 30, { deny: ["mcp__github"] })],
      capabilities: [mcpTool, otherServer],
      version: VERSION,
    });

    const denied = result.capabilities.find(
      (capability) => capability.capabilityId === "mcp__github__issues",
    );
    // The rule is not acted on as a removal — S3 says the form is valid, not
    // what it leaves of the server — but reporting the tool available would be
    // the confident wrong answer §6 warns about.
    expect(denied).toMatchObject({ status: "unknown", enforcement: "unknown" });
    expect(denied?.reasons.at(-1)?.message).toContain('denies "mcp__github"');
    expect(
      result.capabilities.find(
        (capability) => capability.capabilityId === "mcp__linear__list",
      ),
    ).toMatchObject({ status: "available" });
    // A deny rule is never described as pre-approving anything.
    expect(ruleCapability(result, "deny:mcp__github")?.reasons[0]?.message).not.toContain(
      "pre-approves",
    );
  });

  it("never leaves a skill a deny rule names reported as preloaded (S10)", () => {
    const preloaded: ResolvedCapability = {
      ...availableTool("skill:audit"),
      kind: "skill",
      status: "preloaded",
    };
    const other: ResolvedCapability = {
      ...availableTool("skill:format"),
      kind: "skill",
      status: "preloaded",
    };
    const result = resolveSettingsPermissions({
      layers: [layer("project", 30, { deny: ["Skill(audit)"] })],
      capabilities: [preloaded, other],
      version: VERSION,
    });

    expect(
      result.capabilities.find((capability) => capability.capabilityId === "skill:audit"),
    ).toMatchObject({ status: "unknown", enforcement: "unknown" });
    expect(
      result.capabilities.find((capability) => capability.capabilityId === "skill:format"),
    ).toMatchObject({ status: "preloaded" });
  });

  it("treats a bare Skill deny as covering every skill (S10)", () => {
    const result = resolveSettingsPermissions({
      layers: [layer("project", 30, { deny: ["Skill"] })],
      capabilities: [
        { ...availableTool("skill:audit"), kind: "skill", status: "preloaded" },
        availableTool("Skill"),
      ],
      version: VERSION,
    });

    // The Skill tool itself is removed (S5); what the rule leaves of an
    // already preloaded skill is undetermined.
    expect(
      result.capabilities.find((capability) => capability.capabilityId === "Skill"),
    ).toMatchObject({ status: "denied", enforcement: "enforced" });
    expect(
      result.capabilities.find((capability) => capability.capabilityId === "skill:audit"),
    ).toMatchObject({ status: "unknown", enforcement: "unknown" });
  });

  it("is deterministic and collapses a rule repeated in one layer", () => {
    const layers = [layer("project", 30, { allow: ["Read", "Read"] })];
    const first = resolveSettingsPermissions({ layers, capabilities: [], version: VERSION });
    const second = resolveSettingsPermissions({ layers, capabilities: [], version: VERSION });

    expect(first.ruleCapabilities).toHaveLength(1);
    expect(first).toEqual(second);
  });

  it("degrades every rule verdict without a detected CLI version (§8.3)", () => {
    const result = resolveSettingsPermissions({
      layers: [layer("project", 30, { deny: ["Bash"], allow: ["*"] })],
      capabilities: [availableTool("Bash")],
      version: "unknown",
    });

    expect(
      result.capabilities.find((capability) => capability.capabilityId === "Bash"),
    ).toMatchObject({ status: "unknown", enforcement: "unknown" });
    for (const capability of result.ruleCapabilities) {
      expect(capability.enforcement).toBe("unknown");
    }
  });
});
