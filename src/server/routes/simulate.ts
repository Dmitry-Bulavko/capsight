import { Router } from "express";
import {
  ManagedBundleError,
  simulateManagedOverlay,
} from "../../application/simulate.js";
import { UnsupportedPlatformError } from "../../application/platform-guard.js";
import { requireLastScan } from "../helpers/require-scan.js";

export const simulateRouter = Router();

simulateRouter.post("/managed", async (req, res) => {
  const lastScan = requireLastScan(res);
  if (!lastScan) {
    return;
  }

  const managedBundlePath = req.body?.managedBundlePath;
  if (typeof managedBundlePath !== "string" || managedBundlePath.trim() === "") {
    res.status(400).json({ error: "Missing required body field: managedBundlePath" });
    return;
  }

  try {
    const result = await simulateManagedOverlay({
      managedBundlePath,
      snapshot: lastScan.snapshot,
    });
    res.json(result);
  } catch (error) {
    if (error instanceof ManagedBundleError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error instanceof UnsupportedPlatformError) {
      res.status(501).json({ error: error.message });
      return;
    }
    throw error;
  }
});
