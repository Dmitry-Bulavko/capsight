/**
 * S0-01 — Agent SDK tool pool introspection spike (DEV ONLY).
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
 * @see docs/tasks/S0-01-findings.md
 * @see src/adapters/claude/probing/README.md
 */

import { parseArgs } from "node:util";

/** Aggregated probe output for findings doc cross-check. */
export interface AgentSdkProbeResult {
  fixtureCwd: string;
  attemptedApis: string[];
  mcpServerStatus: {
    servers: Array<{
      name: string;
      status: string;
      toolNames: string[];
    }>;
  } | null;
  contextUsage: {
    mcpToolNames: string[];
    deferredBuiltinToolNames: string[];
    systemToolNames: string[];
  } | null;
  initialization: {
    agentNames: string[];
    hasToolsField: false;
  } | null;
  notes: string[];
}

const DEFAULT_PROBE_TIMEOUT_MS = 120_000;

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
    ],
    mcpServerStatus: null,
    contextUsage: null,
    initialization: null,
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

    // --- API 1: mcpServerStatus() — MCP tool names per server ---
    // Docs: returns tools[] with name, description, annotations per server.
    const mcpStatuses = await q.mcpServerStatus();
    result.mcpServerStatus = {
      servers: mcpStatuses.map((s) => ({
        name: s.name,
        status: s.status,
        toolNames: (s.tools ?? []).map((t) => t.name),
      })),
    };

    // --- API 2: getContextUsage() — context breakdown incl. tool names ---
    // Docs: mcpTools, deferredBuiltinTools, systemTools arrays.
    // Caveat: docs note deferredBuiltinTools/systemTools may be absent.
    const usage = await q.getContextUsage();
    result.contextUsage = {
      mcpToolNames: usage.mcpTools.map((t) => t.name),
      deferredBuiltinToolNames: (usage.deferredBuiltinTools ?? []).map(
        (t) => t.name,
      ),
      systemToolNames: (usage.systemTools ?? []).map((t) => t.name),
    };

    // --- API 3: initializationResult() — session bootstrap payload ---
    // Docs: commands, agents, models — NO tools field in response type.
    const init = await q.initializationResult();
    result.initialization = {
      agentNames: init.agents.map((a) => a.name),
      hasToolsField: false,
    };

    // --- API 4: supportedAgents() — subagent defs, not tool pool ---
    const agents = await q.supportedAgents();
    result.notes.push(
      `supportedAgents returned ${agents.length} agent definition(s); not a tool list.`,
    );

    // Drain at least one message so session is live (abort if hung).
    const iter = q[Symbol.asyncIterator]();
    await Promise.race([
      iter.next(),
      new Promise((_, reject) => {
        abort.signal.addEventListener("abort", () =>
          reject(new Error("probe timeout")),
        );
      }),
    ]);

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
    "[S0-01] Starting Agent SDK probe (fixture only). Results are observations, not config facts.",
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
    console.error("[S0-01] Probe failed:", err);
    process.exitCode = 1;
  });
}
