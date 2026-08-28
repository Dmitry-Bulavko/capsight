import { Router } from "express";
import { McpServerNotFoundError, probeMcp } from "../../application/probe-mcp.js";
import { getLastScan } from "../../application/scan-store.js";

export const mcpRouter = Router();

mcpRouter.post("/:id/probe", async (req, res) => {
  const lastScan = getLastScan();
  if (!lastScan) {
    res.status(404).json({ error: "No scan available" });
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
    if (error instanceof McpServerNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    throw error;
  }
});
