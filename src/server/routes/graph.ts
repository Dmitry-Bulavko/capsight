import { Router, type Response } from "express";
import { resolve } from "../../application/resolve.js";
import { UnsupportedPlatformError, assertClaudePlatform } from "../../application/platform-guard.js";
import type { Agent } from "../../core/model/index.js";
import { buildInspectionGraph, filterGraphToAgent } from "../../core/graph/build-graph.js";
import { CLAUDE_TOOL_TABLES } from "../../adapters/claude/resolution/tool-tables.js";
import { getQueryString, parseContextFromQuery } from "../context-query.js";
import { requireLastScan } from "../helpers/require-scan.js";

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

  const requestedAgentId = getQueryString(req.query.agent);
  const activeAgents = lastScan.snapshot.agents.filter((agent: Agent) => agent.status === "active");
  const effectiveByAgent = new Map<string, Awaited<ReturnType<typeof resolve>>>();

  if (requestedAgentId) {
    const selectedAgent = lastScan.snapshot.agents.find((agent: Agent) => agent.id === requestedAgentId);
    if (!selectedAgent) {
      res.status(400).json({ error: `Invalid agent: ${requestedAgentId}` });
      return;
    }
    if (selectedAgent.status !== "active") {
      res.status(400).json({ error: `Agent is not active: ${requestedAgentId}` });
      return;
    }

    const effective = await resolve({
      snapshot: lastScan.snapshot,
      agentId: requestedAgentId,
      context: parsed.context,
    });
    effectiveByAgent.set(requestedAgentId, effective);
  } else {
    for (const agent of activeAgents) {
      const effective = await resolve({
        snapshot: lastScan.snapshot,
        agentId: agent.id,
        context: parsed.context,
      });
      effectiveByAgent.set(agent.id, effective);
    }
  }

  let graph = buildInspectionGraph({
    snapshot: lastScan.snapshot,
    context: parsed.context,
    effectiveByAgent,
    toolTables: CLAUDE_TOOL_TABLES,
  });

  if (requestedAgentId) {
    graph = filterGraphToAgent(graph, requestedAgentId);
  }

  res.json({
    ...graph,
    ...(parsed.contextDefault ? { contextDefault: parsed.contextDefault } : {}),
  });
});
