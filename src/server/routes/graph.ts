import { Router, type Request, type Response } from "express";
import { resolve } from "../../application/resolve.js";
import { getLastScan } from "../../application/scan-store.js";
import { buildInspectionGraph } from "../../core/graph/build-graph.js";
import type { ContextPreset } from "../../core/model/index.js";
import type { PermissionMode } from "../../adapters/claude/model/index.js";
import { buildExecutionContext } from "../../adapters/claude/resolution/context.js";
import { CLAUDE_TOOL_TABLES } from "../../adapters/claude/resolution/tool-tables.js";

const CONTEXT_PRESETS = new Set<ContextPreset>([
  "main-session",
  "foreground-subagent",
  "background-subagent",
  "fork",
  "explore",
  "plan",
  "teammate",
]);

const PERMISSION_MODES = new Set<PermissionMode>([
  "default",
  "acceptEdits",
  "auto",
  "dontAsk",
  "bypassPermissions",
  "plan",
]);

function getQueryString(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }
  return undefined;
}

function requireLastScan(res: Response) {
  const lastScan = getLastScan();
  if (!lastScan) {
    res.status(404).json({ error: "No scan available" });
    return null;
  }
  return lastScan;
}

function parseContextFromQuery(
  req: Request,
): { context: ReturnType<typeof buildExecutionContext> } | { error: string } {
  const preset =
    getQueryString(req.query.context) ?? ("main-session" satisfies ContextPreset);

  if (!CONTEXT_PRESETS.has(preset as ContextPreset)) {
    return { error: `Invalid context preset: ${preset}` };
  }

  const overrides: {
    depth?: number;
    parentPermissionMode?: PermissionMode;
  } = {};

  if (req.query.depth !== undefined) {
    const depthRaw = getQueryString(req.query.depth);
    if (depthRaw === undefined) {
      return { error: "Invalid depth" };
    }
    const depth = Number.parseInt(depthRaw, 10);
    if (Number.isNaN(depth)) {
      return { error: "Invalid depth" };
    }
    overrides.depth = depth;
  }

  const parentMode = getQueryString(req.query.parentMode);
  if (parentMode !== undefined) {
    if (!PERMISSION_MODES.has(parentMode as PermissionMode)) {
      return { error: `Invalid parentMode: ${parentMode}` };
    }
    overrides.parentPermissionMode = parentMode as PermissionMode;
  }

  return {
    context: buildExecutionContext(preset as ContextPreset, overrides),
  };
}

export const graphRouter = Router();

graphRouter.get("/", async (req, res) => {
  const lastScan = requireLastScan(res);
  if (!lastScan) {
    return;
  }

  const parsed = parseContextFromQuery(req);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const activeAgents = lastScan.snapshot.agents.filter((agent) => agent.status === "active");
  const effectiveByAgent = new Map<string, Awaited<ReturnType<typeof resolve>>>();

  for (const agent of activeAgents) {
    const effective = await resolve({
      snapshot: lastScan.snapshot,
      agentId: agent.id,
      context: parsed.context,
    });
    effectiveByAgent.set(agent.id, effective);
  }

  const graph = buildInspectionGraph({
    snapshot: lastScan.snapshot,
    context: parsed.context,
    effectiveByAgent,
    toolTables: CLAUDE_TOOL_TABLES,
  });

  res.json(graph);
});
