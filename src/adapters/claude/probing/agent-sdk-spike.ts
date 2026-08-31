/**
 * S0-01 / S9P-01 — Agent SDK tool pool introspection spike (DEV ONLY).
 *
 * NOT wired to Capsight scan. NOT auto-run. Manual invocation only.
 *
 * Prerequisites (developer machine):
 *   npm install -D @anthropic-ai/claude-agent-sdk
 *   Claude Code CLI available (bundled with SDK or pathToClaudeCodeExecutable)
 *   ANTHROPIC_API_KEY or claude.ai auth for a live session
 *
 * Safety (SPEC §9.4):
 *   - Run only against tests/fixtures/claude/* fixture projects
 *   - Explicit developer mode; never on user projects from scan
 *   - Process timeout + isolation; no third-party MCP without approval
 *
 * Manual run example:
 *   npx tsx src/adapters/claude/probing/agent-sdk-spike.ts \
 *     --fixture tests/fixtures/claude/<name>/project
 *
 * @see docs/S9P-PROBE-FINDINGS.md
 * @see src/adapters/claude/probing/README.md
 */

/// <reference path="./agent-sdk-types.shim.d.ts" />

import { parseArgs } from "node:util";
import type {
  AgentInfo,
  ContextUsageToolEntry,
  McpServerStatus,
  McpServerToolInfo,
} from "@anthropic-ai/claude-agent-sdk";
import {
  extractInitToolsFromStreamMessage,
  type AgentSdkProbeResult,
} from "./agent-sdk-probe-schema.js";

export type { AgentSdkProbeResult, AgentSdkProbeRecording } from "./agent-sdk-probe-schema.js";
export {
  extractInitToolsFromStreamMessage,
  validateAgentSdkProbeRecording,
} from "./agent-sdk-probe-schema.js";

const DEFAULT_PROBE_TIMEOUT_MS = 120_000;
const MAX_STREAM_MESSAGES_FOR_INIT = 20;

function parseFixtureCwd(argv: string[]): string | undefined {
  const { values } = parseArgs({
    args: argv,
    options: {
      fixture: { type: "string" },
    },
    strict: false,
  });
  const fixture = values.fixture;
  return typeof fixture === "string" ? fixture : undefined;
}

async function collectInitStreamToolNames(
  q: AsyncIterable<unknown> & { close(): void },
  signal: AbortSignal,
): Promise<string[] | null> {
  const iter = q[Symbol.asyncIterator]();

  for (let i = 0; i < MAX_STREAM_MESSAGES_FOR_INIT; i++) {
    if (signal.aborted) break;

    const next = await Promise.race([
      iter.next(),
      new Promise<IteratorResult<unknown>>((_, reject) => {
        const onAbort = () => reject(new Error("probe timeout"));
        if (signal.aborted) onAbort();
        else signal.addEventListener("abort", onAbort, { once: true });
      }),
    ]);

    if (next.done) break;

    const toolNames = extractInitToolsFromStreamMessage(next.value);
    if (toolNames) return toolNames;
  }

  return null;
}

/**
 * Probe structural tool-pool APIs documented on Query.
 * Does NOT invoke tools or start MCP servers beyond fixture config.
 */
export async function probeAgentSdkToolPool(
  fixtureCwd: string,
  options?: { timeoutMs?: number },
): Promise<AgentSdkProbeResult> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;
  const result: AgentSdkProbeResult = {
    fixtureCwd,
    attemptedApis: [
      "mcpServerStatus",
      "getContextUsage",
      "initializationResult",
      "supportedAgents",
      "streamInitTools",
    ],
    mcpServerStatus: null,
    contextUsage: null,
    initialization: null,
    initStreamTools: null,
    notes: [],
  };

  // Dynamic import keeps SDK optional for CI typecheck.
  const { query } = await import("@anthropic-ai/claude-agent-sdk");

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);

  try {
    const q = query({
      cwd: fixtureCwd,
      prompt: "Reply with exactly: probe-ready",
      settingSources: ["project"],
      strictMcpConfig: true,
      maxTurns: 1,
      permissionMode: "plan",
    });

    const streamToolNamesPromise = collectInitStreamToolNames(q, abort.signal);

    // --- API 1: mcpServerStatus() — MCP tool names per server ---
    const mcpStatuses = await q.mcpServerStatus();
    result.mcpServerStatus = {
      servers: mcpStatuses.map((s: McpServerStatus) => ({
        name: s.name,
        status: s.status,
        toolNames: (s.tools ?? []).map((t: McpServerToolInfo) => t.name),
      })),
    };

    // --- API 2: getContextUsage() — context breakdown incl. tool names ---
    const usage = await q.getContextUsage();
    result.contextUsage = {
      mcpToolNames: usage.mcpTools.map((t) => t.name),
      deferredBuiltinToolNames: (usage.deferredBuiltinTools ?? []).map(
        (t: ContextUsageToolEntry & { isLoaded: boolean }) => t.name,
      ),
      systemToolNames: (usage.systemTools ?? []).map((t: ContextUsageToolEntry) => t.name),
    };

    // --- API 3: initializationResult() — session bootstrap payload ---
    const init = await q.initializationResult();
    result.initialization = {
      agentNames: init.agents.map((a: AgentInfo) => a.name),
      hasToolsField: false,
    };

    // --- API 4: supportedAgents() — subagent defs, not tool pool ---
    const agents = await q.supportedAgents();
    result.notes.push(
      `supportedAgents returned ${agents.length} agent definition(s); not a tool list.`,
    );

    // --- API 5: stream init tools[] from SDKSystemMessage when present ---
    const streamToolNames = await streamToolNamesPromise;
    if (streamToolNames) {
      result.initStreamTools = { toolNames: streamToolNames };
    } else {
      result.notes.push(
        "No init stream tools[] observed in first stream messages (may be absent or arrive later).",
      );
    }

    q.close();
    return result;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Entry point — only runs when executed directly, never from scan pipeline.
 */
async function main(): Promise<void> {
  const fixtureCwd = parseFixtureCwd(process.argv.slice(2));
  if (!fixtureCwd) {
    console.error(
      "Usage: npx tsx src/adapters/claude/probing/agent-sdk-spike.ts --fixture <path>",
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    "[S9P-01] Starting Agent SDK probe (fixture only). Results are observations, not config facts.",
  );
  const result = await probeAgentSdkToolPool(fixtureCwd);
  console.log(JSON.stringify(result, null, 2));
}

const isDirectRun =
  typeof process.argv[1] === "string" &&
  (process.argv[1].endsWith("agent-sdk-spike.ts") ||
    process.argv[1].endsWith("agent-sdk-spike.js"));

if (isDirectRun) {
  main().catch((err: unknown) => {
    console.error("[S9P-01] Probe failed:", err);
    process.exitCode = 1;
  });
}
