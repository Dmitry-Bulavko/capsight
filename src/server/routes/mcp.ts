import { Router } from "express";
import {
  McpServerAmbiguousError,
  McpServerNotFoundError,
  probeMcp,
} from "../../application/probe-mcp.js";
import { requireLastScan } from "../helpers/require-scan.js";

export const mcpRouter = Router();

mcpRouter.post("/:id/probe", async (req, res) => {
  const lastScan = requireLastScan(res);
  if (!lastScan) {
    return;
  }

  const confirmed = req.body?.confirm === true;

  try {
    const result = await probeMcp({
      serverId: req.params.id,
      confirmed,
    });
    res.json(result);
  } catch (error) {
    if (error instanceof McpServerAmbiguousError) {
      res.status(409).json({ error: error.message, candidates: error.candidates });
      return;
    }
    if (error instanceof McpServerNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    throw error;
  }
});
