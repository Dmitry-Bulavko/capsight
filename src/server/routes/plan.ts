import { Router } from "express";
import { plan } from "../../application/plan.js";
import { UnsupportedPlatformError } from "../../application/platform-guard.js";
import { getLastScan } from "../../application/scan-store.js";

export const planRouter = Router();

planRouter.post("/", async (req, res) => {
  const lastScan = getLastScan();
  if (!lastScan) {
    res.status(404).json({ error: "No scan available" });
    return;
  }

  const pending = req.body?.pending;
  const editSnapshotId = req.body?.editSnapshotId;

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
    const result = await plan({
      pending,
      editSnapshotId,
      snapshot: lastScan.snapshot,
    });
    res.json(result);
  } catch (error) {
    if (error instanceof UnsupportedPlatformError) {
      res.status(501).json({ error: error.message });
      return;
    }
    throw error;
  }
});
