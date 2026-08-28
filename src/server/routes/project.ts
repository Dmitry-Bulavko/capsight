import { Router } from "express";
import {
  buildStatusSummary,
  getLastScan,
  scanAndStore,
} from "../../application/scan-store.js";

export const projectRouter = Router();

projectRouter.post("/scan", async (req, res) => {
  const projectPath = req.body?.projectPath ?? process.cwd();
  const result = await scanAndStore(projectPath);
  res.json(result);
});

projectRouter.get("/", (_req, res) => {
  const lastScan = getLastScan();
  if (!lastScan) {
    res.status(404).json({ error: "No scan available" });
    return;
  }
  res.json(buildStatusSummary(lastScan));
});
