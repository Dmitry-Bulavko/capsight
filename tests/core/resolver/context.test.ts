import { afterEach, describe, expect, it } from "vitest";
import { buildExecutionContext } from "../../../src/adapters/claude/resolution/context.js";
import { getDefaultMaxDepth } from "../../../src/adapters/claude/environment/depth.js";
import type { ContextPreset } from "../../../src/core/model/index.js";

const PRESET_EXPECTATIONS: Record<
  ContextPreset,
  {
    isMainSession: boolean;
    isBackground: boolean;
    isFork: boolean;
    isTeammate: boolean;
    builtinKind?: "explore" | "plan";
  }
> = {
  "main-session": {
    isMainSession: true,
    isBackground: false,
    isFork: false,
    isTeammate: false,
  },
  "foreground-subagent": {
    isMainSession: false,
    isBackground: false,
    isFork: false,
    isTeammate: false,
  },
  "background-subagent": {
    isMainSession: false,
    isBackground: true,
    isFork: false,
    isTeammate: false,
  },
  fork: {
    isMainSession: false,
    isBackground: true,
    isFork: true,
    isTeammate: false,
  },
  explore: {
    isMainSession: false,
    isBackground: false,
    isFork: false,
    isTeammate: false,
    builtinKind: "explore",
  },
  plan: {
    isMainSession: false,
    isBackground: false,
    isFork: false,
    isTeammate: false,
    builtinKind: "plan",
  },
  teammate: {
    isMainSession: false,
    isBackground: false,
    isFork: false,
    isTeammate: true,
  },
};

describe("buildExecutionContext", () => {
  const originalEnv = process.env.CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH;
    } else {
      process.env.CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH = originalEnv;
    }
  });

  it.each(Object.entries(PRESET_EXPECTATIONS) as [ContextPreset, (typeof PRESET_EXPECTATIONS)[ContextPreset]][])(
    "preset %s matches SPEC §4.3 flags",
    (preset, expected) => {
      delete process.env.CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH;
      const ctx = buildExecutionContext(preset);

      expect(ctx.preset).toBe(preset);
      expect(ctx.isMainSession).toBe(expected.isMainSession);
      expect(ctx.isBackground).toBe(expected.isBackground);
      expect(ctx.isFork).toBe(expected.isFork);
      expect(ctx.isTeammate).toBe(expected.isTeammate);
      if (expected.builtinKind === undefined) {
        expect(ctx.builtinKind).toBeUndefined();
      } else {
        expect(ctx.builtinKind).toBe(expected.builtinKind);
      }
      expect(ctx.depth).toBe(0);
      expect(ctx.maxDepth).toBe(3);
      expect(ctx.parentPermissionMode).toBeUndefined();
    },
  );

  it("applies depth, maxDepth, and parentPermissionMode overrides", () => {
    const ctx = buildExecutionContext("background-subagent", {
      depth: 2,
      maxDepth: 5,
      parentPermissionMode: "bypassPermissions",
    });

    expect(ctx.depth).toBe(2);
    expect(ctx.maxDepth).toBe(5);
    expect(ctx.parentPermissionMode).toBe("bypassPermissions");
  });

  it("uses CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH when set", () => {
    process.env.CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH = "7";
    expect(buildExecutionContext("main-session").maxDepth).toBe(7);
  });

  it("falls back to 3 for invalid CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH", () => {
    process.env.CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH = "not-a-number";
    expect(buildExecutionContext("main-session").maxDepth).toBe(3);
  });
});

describe("getDefaultMaxDepth", () => {
  it("returns 3 when env is unset", () => {
    expect(getDefaultMaxDepth({})).toBe(3);
  });

  it("parses env value", () => {
    expect(
      getDefaultMaxDepth({ CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH: "1" }),
    ).toBe(1);
  });
});
