import { Router, type Response } from "express";
import {
  collectAgentWarnings,
} from "../../application/collect-warnings.js";
import { AgentNotFoundError, resolve } from "../../application/resolve.js";
import { getAgentsFromResult } from "../../application/scan-store.js";
import { getQueryString, parseContextFromQuery } from "../context-query.js";
import { requireLastScan } from "../helpers/require-scan.js";

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

export type { AgentWarning } from "../../application/collect-warnings.js";

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

  const warnings = await collectAgentWarnings({
    snapshot: lastScan.snapshot,
    context: parsed.context,
  });

  res.json({
    warnings,
    ...(parsed.contextDefault ? { contextDefault: parsed.contextDefault } : {}),
  });
});
