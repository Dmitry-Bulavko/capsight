import { Router } from "express";
import {
  applyConfiguration,
  ApplyNotConfirmedError,
  ApplyOperationNotFoundError,
  getHistory,
  rollbackConfiguration,
  RollbackNotConfirmedError,
  SnapshotChangedError,
} from "../../application/apply.js";
import { getLastScan } from "../../application/scan-store.js";

export const applyRouter = Router();

applyRouter.post("/", async (req, res) => {
  const lastScan = getLastScan();
  if (!lastScan) {
    res.status(404).json({ error: "No scan available" });
    return;
  }

  const pending = req.body?.pending;
  const editSnapshotId = req.body?.editSnapshotId;
  const confirmed = req.body?.confirmed === true;
  const acknowledgeSnapshotChange = req.body?.acknowledgeSnapshotChange === true;

  if (
    pending === undefined ||
    typeof pending !== "object" ||
    pending === null ||
    typeof pending.byAgent !== "object" ||
    pending.byAgent === null
  ) {
    res.status(400).json({ error: "Missing required body field: pending.byAgent" });
    return;
  }

  if (typeof editSnapshotId !== "string" || editSnapshotId.trim() === "") {
    res.status(400).json({ error: "Missing required body field: editSnapshotId" });
    return;
  }

  try {
    const result = await applyConfiguration({
      pending,
      editSnapshotId,
      confirmed,
      acknowledgeSnapshotChange,
      snapshot: lastScan.snapshot,
    });
    res.json(result);
  } catch (error) {
    if (error instanceof ApplyNotConfirmedError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error instanceof SnapshotChangedError) {
      res.status(409).json({
        error: error.message,
        warnings: error.warnings,
        plan: error.plan,
      });
      return;
    }
    throw error;
  }
});

export const rollbackRouter = Router();

rollbackRouter.post("/:operationId", async (req, res) => {
  const lastScan = getLastScan();
  if (!lastScan) {
    res.status(404).json({ error: "No scan available" });
    return;
  }

  const confirmed = req.body?.confirmed === true;
  const operationId = req.params.operationId;

  if (typeof operationId !== "string" || operationId.trim() === "") {
    res.status(400).json({ error: "Missing operation id" });
    return;
  }

  try {
    const result = await rollbackConfiguration({
      operationId,
      confirmed,
      projectPath: lastScan.snapshot.projectPath,
    });
    res.json(result);
  } catch (error) {
    if (error instanceof RollbackNotConfirmedError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error instanceof ApplyOperationNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    throw error;
  }
});

export const historyRouter = Router();

historyRouter.get("/", async (_req, res) => {
  const lastScan = getLastScan();
  if (!lastScan) {
    res.status(404).json({ error: "No scan available" });
    return;
  }

  const operations = await getHistory(lastScan.snapshot.projectPath);
  res.json({ operations });
});
