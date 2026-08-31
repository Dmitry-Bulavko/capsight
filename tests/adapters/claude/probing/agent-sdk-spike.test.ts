import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  extractInitToolsFromStreamMessage,
  probeAgentSdkToolPool,
  validateAgentSdkProbeRecording,
} from "../../../../src/adapters/claude/probing/agent-sdk-spike.js";

const fixtureRecordingPath = path.join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../fixtures/probes/agent-sdk/claude-basic.json",
);

function makeMockQuery(messages: unknown[]) {
  let index = 0;
  const asyncIterator = {
    async next(): Promise<IteratorResult<unknown>> {
      if (index >= messages.length) return { done: true, value: undefined };
      const value = messages[index];
      index += 1;
      return { done: false, value };
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };

  return {
    ...asyncIterator,
    mcpServerStatus: vi.fn(async () => [
      {
        name: "github",
        status: "connected",
        tools: [{ name: "search_repositories" }, { name: "get_issue" }],
      },
    ]),
    getContextUsage: vi.fn(async () => ({
      mcpTools: [{ name: "search_repositories", serverName: "github", tokens: 120 }],
      deferredBuiltinTools: [{ name: "Read", tokens: 40, isLoaded: true }],
      systemTools: [{ name: "Task", tokens: 30 }],
      totalTokens: 1000,
      maxTokens: 200000,
      model: "claude-sonnet-4-20250514",
    })),
    initializationResult: vi.fn(async () => ({
      commands: [],
      agents: [{ name: "backend", description: "Backend agent" }],
      models: [],
      account: {},
    })),
    supportedAgents: vi.fn(async () => [
      { name: "backend", description: "Backend agent" },
      { name: "Explore", description: "Built-in explorer" },
    ]),
    close: vi.fn(),
  };
}

describe("extractInitToolsFromStreamMessage", () => {
  it("returns tool names from system init stream message", () => {
    expect(
      extractInitToolsFromStreamMessage({
        type: "system",
        subtype: "init",
        tools: ["Read", "Grep", "Bash"],
      }),
    ).toEqual(["Read", "Grep", "Bash"]);
  });

  it("returns null for non-init messages", () => {
    expect(
      extractInitToolsFromStreamMessage({
        type: "assistant",
        message: { content: [] },
      }),
    ).toBeNull();
  });

  it("returns null when tools array is empty", () => {
    expect(
      extractInitToolsFromStreamMessage({
        type: "system",
        subtype: "init",
        tools: [],
      }),
    ).toBeNull();
  });
});

describe("probeAgentSdkToolPool", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("captures init stream toolNames and normalizes API payloads", async () => {
    const mockQuery = makeMockQuery([
      { type: "system", subtype: "init", tools: ["Read", "Grep", "Write"] },
      { type: "assistant", message: { content: [{ type: "text", text: "probe-ready" }] } },
    ]);

    vi.doMock("@anthropic-ai/claude-agent-sdk", () => ({
      query: vi.fn(() => mockQuery),
    }));

    const { probeAgentSdkToolPool: probe } = await import(
      "../../../../src/adapters/claude/probing/agent-sdk-spike.js"
    );

    const result = await probe("/tmp/fixture", { timeoutMs: 5_000 });

    expect(result.fixtureCwd).toBe("/tmp/fixture");
    expect(result.attemptedApis).toContain("streamInitTools");
    expect(result.initStreamTools).toEqual({
      toolNames: ["Read", "Grep", "Write"],
    });
    expect(result.mcpServerStatus).toEqual({
      servers: [
        {
          name: "github",
          status: "connected",
          toolNames: ["search_repositories", "get_issue"],
        },
      ],
    });
    expect(result.contextUsage).toEqual({
      mcpToolNames: ["search_repositories"],
      deferredBuiltinToolNames: ["Read"],
      systemToolNames: ["Task"],
    });
    expect(result.initialization).toEqual({
      agentNames: ["backend"],
      hasToolsField: false,
    });
    expect(mockQuery.close).toHaveBeenCalledOnce();
  });

  it("records note when init stream tools are absent", async () => {
    const mockQuery = makeMockQuery([
      { type: "assistant", message: { content: [{ type: "text", text: "ok" }] } },
    ]);

    vi.doMock("@anthropic-ai/claude-agent-sdk", () => ({
      query: vi.fn(() => mockQuery),
    }));

    const { probeAgentSdkToolPool: probe } = await import(
      "../../../../src/adapters/claude/probing/agent-sdk-spike.js"
    );

    const result = await probe("/tmp/fixture", { timeoutMs: 5_000 });

    expect(result.initStreamTools).toBeNull();
    expect(result.notes.some((note) => note.includes("No init stream tools[]"))).toBe(true);
  });
});

describe("recorded agent-sdk probe fixture", () => {
  it("validates committed claude/basic payload schema without live SDK", async () => {
    const raw = JSON.parse(await readFile(fixtureRecordingPath, "utf8")) as unknown;

    expect(validateAgentSdkProbeRecording(raw)).toBe(true);
    if (!validateAgentSdkProbeRecording(raw)) return;

    expect(raw.meta.fixtureId).toBe("claude/basic");
    expect(raw.meta.provenance).toBe("doc-derived-synthetic");
    expect(raw.result.initStreamTools?.toolNames.length).toBeGreaterThan(0);
    expect(raw.result.initialization?.hasToolsField).toBe(false);
  });
});
