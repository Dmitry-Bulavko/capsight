import { describe, expect, it } from "vitest";
import type { EffectiveConfiguration, ResolvedCapability } from "../../src/core/model/index.js";
import {
  capabilityKindForId,
  opensAsideDetail,
  shouldOpenAsideDetail,
} from "../../src/ui/capability-aside-detail.js";

function makeEffective(capabilities: ResolvedCapability[]): EffectiveConfiguration {
  return {
    agentId: "backend",
    context: {
      preset: "foreground-subagent",
      isMainSession: false,
      isBackground: false,
      isFork: false,
      isTeammate: false,
      depth: 0,
      maxDepth: 3,
    },
    version: {
      platform: "claude",
      version: "2.1.0",
      raw: "2.1.0",
      detectedAt: "2026-01-01T00:00:00.000Z",
    },
    capabilities,
    warnings: [],
    unknownRate: 0,
  };
}

describe("capability-aside-detail", () => {
  it("opens aside detail only for tools and permissions", () => {
    expect(opensAsideDetail("tool")).toBe(true);
    expect(opensAsideDetail("permission")).toBe(true);
    expect(opensAsideDetail("skill")).toBe(false);
    expect(opensAsideDetail("instruction")).toBe(false);
    expect(opensAsideDetail("mcp_tool")).toBe(false);
  });

  it("resolves kind from effective config with tool fallback", () => {
    const effective = makeEffective([
      {
        capabilityId: "skill:lint",
        kind: "skill",
        status: "available",
        enforcement: "enforced",
        sources: [],
        reasons: [],
      },
    ]);

    expect(capabilityKindForId("skill:lint", effective)).toBe("skill");
    expect(capabilityKindForId("Read", effective)).toBe("tool");
    expect(shouldOpenAsideDetail("Read", effective)).toBe(true);
    expect(shouldOpenAsideDetail("skill:lint", effective)).toBe(false);
  });
});
