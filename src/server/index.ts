import express from "express";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  agentsRouter,
  capabilitiesRouter,
  warningsRouter,
} from "./routes/agents.js";
import { mcpRouter } from "./routes/mcp.js";
import { projectRouter } from "./routes/project.js";
import { graphRouter } from "./routes/graph.js";
import { simulateRouter } from "./routes/simulate.js";
import { planRouter } from "./routes/plan.js";
import { applyRouter, historyRouter, rollbackRouter } from "./routes/apply.js";
import { ecosystemRouter } from "./routes/ecosystem.js";
import { observedRouter } from "./routes/observed.js";
import {
  buildAllowedApiOrigins,
  createApiMutationGuard,
} from "./middleware/api-guard.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3847);
const HOST = process.env.HOST ?? "127.0.0.1";

export function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use(createApiMutationGuard(buildAllowedApiOrigins(PORT)));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "capsight" });
  });

  app.use("/api/project", projectRouter);
  app.use("/api/agents", agentsRouter);
  app.use("/api/capabilities", capabilitiesRouter);
  app.use("/api/warnings", warningsRouter);
  app.use("/api/mcp", mcpRouter);
  app.use("/api/graph", graphRouter);
  app.use("/api/simulate", simulateRouter);
  app.use("/api/plan", planRouter);
  app.use("/api/apply", applyRouter);
  app.use("/api/rollback", rollbackRouter);
  app.use("/api/history", historyRouter);
  app.use("/api/ecosystem", ecosystemRouter);
  app.use("/api/observed", observedRouter);

  if (process.env.NODE_ENV === "production") {
    const uiDir = path.resolve(__dirname, "../ui");
    app.use(express.static(uiDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(uiDir, "index.html"));
    });
  }

  return app;
}

export const app = createApp();

const isMainModule =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMainModule) {
  app.listen(PORT, HOST, () => {
    console.log(`Capsight server listening on http://${HOST}:${PORT}`);
  });
}
