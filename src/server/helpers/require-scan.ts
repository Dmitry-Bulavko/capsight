import type { Response } from "express";
import type { ScanResult } from "../../application/scan.js";
import { getLastScan } from "../../application/scan-store.js";

export function requireLastScan(res: Response): ScanResult | null {
  const lastScan = getLastScan();
  if (!lastScan) {
    res.status(404).json({ error: "No scan available" });
    return null;
  }
  return lastScan;
}
