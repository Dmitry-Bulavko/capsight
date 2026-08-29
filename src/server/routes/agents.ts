import { Router, type Response } from "express";
import { AgentNotFoundError, resolve } from "../../application/resolve.js";
import { getAgentsFromResult, getLastScan } from "../../application/scan-store.js";
import type { Warning } from "../../core/model/index.js";
import { getQueryString, parseContextFromQuery } from "../context-query.js";

function requireLastScan(res: Response) {
  const lastScan = getLastScan();
  if (!lastScan) {
    res.status(404).json({ error: "No scan available" });
    return null;
  }
  return lastScan;
}

export const agentsRouter = Router();

agentsRouter.get("/", (_req, res) => {
  const lastScan = requireLastScan(res);
  if (!lastScan) {
    return;
  }
  res.json({ agents: getAgentsFromResult(lastScan) });
});

agentsRouter.get("/:id/effective", async (req, res) => {
  const lastScan = requireLastScan(res);
  if (!lastScan) {
    return;
  }

  const parsed = parseContextFromQuery(req);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  try {
    const effective = await resolve({
      snapshot: lastScan.snapshot,
      agentId: req.params.id,
      context: parsed.context,
    });
    res.json({
      ...effective,
      ...(parsed.contextDefault ? { contextDefault: parsed.contextDefault } : {}),
    });
  } catch (error) {
    if (error instanceof AgentNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    throw error;
  }
});

export const capabilitiesRouter = Router();

capabilitiesRouter.get("/:id/explain", async (req, res) => {
  const lastScan = requireLastScan(res);
  if (!lastScan) {
    return;
  }

  const agentId = getQueryString(req.query.agent);
  if (!agentId) {
    res.status(400).json({ error: "Missing required query parameter: agent" });
    return;
  }

  const parsed = parseContextFromQuery(req);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  try {
    const effective = await resolve({
      snapshot: lastScan.snapshot,
      agentId,
      context: parsed.context,
    });
    const capability = effective.capabilities.find(
      (entry) => entry.capabilityId === req.params.id,
    );
    if (!capability) {
      res.status(404).json({ error: `Capability not found: ${req.params.id}` });
      return;
    }
    res.json({
      agentId,
      context: effective.context,
      capability,
      ...(parsed.contextDefault ? { contextDefault: parsed.contextDefault } : {}),
    });
  } catch (error) {
    if (error instanceof AgentNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    throw error;
  }
});

export interface AgentWarning extends Warning {
  agentId: string;
}

export const warningsRouter = Router();

warningsRouter.get("/", async (req, res) => {
  const lastScan = requireLastScan(res);
  if (!lastScan) {
    return;
  }

  const parsed = parseContextFromQuery(req);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const warnings: AgentWarning[] = [];
  const activeAgents = lastScan.snapshot.agents.filter((agent) => agent.status === "active");

  for (const agent of activeAgents) {
    const effective = await resolve({
      snapshot: lastScan.snapshot,
      agentId: agent.id,
      context: parsed.context,
    });
    for (const warning of effective.warnings) {
      warnings.push({ ...warning, agentId: agent.id });
    }
  }

  res.json({
    warnings,
    ...(parsed.contextDefault ? { contextDefault: parsed.contextDefault } : {}),
  });
});
