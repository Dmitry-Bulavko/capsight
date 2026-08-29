import { Router, type Response } from "express";
import { resolve } from "../../application/resolve.js";
import { UnsupportedPlatformError, assertClaudePlatform } from "../../application/platform-guard.js";
import { getLastScan } from "../../application/scan-store.js";
import { buildInspectionGraph } from "../../core/graph/build-graph.js";
import { CLAUDE_TOOL_TABLES } from "../../adapters/claude/resolution/tool-tables.js";
import { parseContextFromQuery } from "../context-query.js";

function requireLastScan(res: Response) {
  const lastScan = getLastScan();
  if (!lastScan) {
    res.status(404).json({ error: "No scan available" });
    return null;
  }
  return lastScan;
}

export const graphRouter = Router();

graphRouter.get("/", async (req, res) => {
  const lastScan = requireLastScan(res);
  if (!lastScan) {
    return;
  }

  try {
    assertClaudePlatform(lastScan.snapshot, "Inspection graph");
  } catch (error) {
    if (error instanceof UnsupportedPlatformError) {
      res.status(501).json({ error: error.message });
      return;
    }
    throw error;
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

  res.json({
    ...graph,
    ...(parsed.contextDefault ? { contextDefault: parsed.contextDefault } : {}),
  });
});
