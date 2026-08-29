import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ADAPTER_ID as CLAUDE_ADAPTER_ID } from "../../src/adapters/claude/adapter.js";
import { ADAPTER_ID as CODEX_ADAPTER_ID } from "../../src/adapters/codex/adapter.js";
import { ADAPTER_ID as CURSOR_ADAPTER_ID } from "../../src/adapters/cursor/adapter.js";
import {
  DEFAULT_PLATFORM_ID,
  getAdapter,
  UnknownPlatformError,
  parsePlatformId,
} from "../../src/adapters/registry.js";
import { scan } from "../../src/application/scan.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const basicFixture = path.join(__dirname, "../fixtures/claude/basic/project");

describe("adapter registry", () => {
  it("defaults to claude", () => {
    expect(DEFAULT_PLATFORM_ID).toBe("claude");
    expect(getAdapter().id).toBe(CLAUDE_ADAPTER_ID);
  });

  it("returns registered adapters by platform id", () => {
    expect(getAdapter("claude").id).toBe(CLAUDE_ADAPTER_ID);
    expect(getAdapter("cursor").id).toBe(CURSOR_ADAPTER_ID);
    expect(getAdapter("codex").id).toBe(CODEX_ADAPTER_ID);
  });

  it("parses known platform ids", () => {
    expect(parsePlatformId("claude")).toBe("claude");
    expect(parsePlatformId("cursor")).toBe("cursor");
    expect(parsePlatformId("codex")).toBe("codex");
    expect(parsePlatformId("unknown")).toBeUndefined();
  });

  it("routes default scan through claude adapter", async () => {
    const result = await scan({ projectPath: basicFixture });

    expect(result.platform).toBe("claude");
    expect(result.snapshot.version.platform).toBe("claude");
    expect(result.status).toBe("complete");
  });

  it("routes codex scan through codex adapter", async () => {
    const codexFixture = path.join(__dirname, "../fixtures/codex/basic/project");
    const result = await scan({ projectPath: codexFixture, platform: "codex" });

    expect(result.platform).toBe("codex");
    expect(result.snapshot.version.platform).toBe("codex");
    expect(result.status).toBe("complete");
    expect(result.snapshot.agents.some((agent) => agent.name === "main")).toBe(true);
  });

  it("routes cursor scan through cursor adapter", async () => {
    const cursorFixture = path.join(__dirname, "../fixtures/cursor/basic/project");
    const result = await scan({ projectPath: cursorFixture, platform: "cursor" });

    expect(result.platform).toBe("cursor");
    expect(result.snapshot.version.platform).toBe("cursor");
    expect(result.status).toBe("complete");
    expect(result.snapshot.agents.some((agent) => agent.name === "example")).toBe(true);
  });

  it("throws UnknownPlatformError for unsupported snapshot platforms during resolve", async () => {
    const { resolve } = await import("../../src/application/resolve.js");
    const { buildExecutionContext } = await import(
      "../../src/adapters/claude/resolution/context.js"
    );

    const snapshot = (await scan({ projectPath: basicFixture })).snapshot;
    const agent = snapshot.agents.find((entry) => entry.status === "active");
    expect(agent).toBeDefined();

    await expect(
      resolve({
        snapshot: {
          ...snapshot,
          version: { ...snapshot.version, platform: "unsupported" },
        },
        agentId: agent!.id,
        context: buildExecutionContext("main-session"),
      }),
    ).rejects.toThrow(UnknownPlatformError);
  });
});
