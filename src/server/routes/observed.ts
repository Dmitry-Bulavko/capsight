import { Router } from "express";
import { loadObservedDemoPayload } from "../../application/observed-demo.js";

export const observedRouter = Router();

observedRouter.get("/", async (_req, res) => {
  if (process.env.NODE_ENV === "production") {
    res.status(404).json({ error: "Observed layer is not available in production" });
    return;
  }

  const payload = await loadObservedDemoPayload();
  if (!payload) {
    res.status(404).json({ error: "No observed demo payload available" });
    return;
  }

  res.json(payload);
});
