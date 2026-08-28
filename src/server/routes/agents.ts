import { Router, type Request, type Response } from "express";
import { AgentNotFoundError, resolve } from "../../application/resolve.js";
import { getAgentsFromResult, getLastScan } from "../../application/scan-store.js";
import type { ContextPreset, PermissionMode, Warning } from "../../core/model/index.js";
import { buildExecutionContext } from "../../core/resolver/context.js";

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
    res.json(effective);
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

  res.json({ warnings });
});
