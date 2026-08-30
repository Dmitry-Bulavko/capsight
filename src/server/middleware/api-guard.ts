import type { NextFunction, Request, Response } from "express";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const ECOSYSTEM_CONTENT_ROUTE_RE = /^\/api\/ecosystem\/resource\/[^/]+\/content$/;

function devUiOrigins(): string[] {
  const origins: string[] = [];

  const customOrigin = process.env.CAPSIGHT_DEV_ORIGIN?.trim();
  if (customOrigin) {
    origins.push(customOrigin);
  }

  const vitePort = Number(process.env.VITE_PORT ?? 5173);
  if (Number.isFinite(vitePort)) {
    origins.push(`http://localhost:${vitePort}`, `http://127.0.0.1:${vitePort}`);
  }

  return origins;
}

export function buildAllowedApiOrigins(apiPort: number): ReadonlySet<string> {
  return new Set([
    `http://localhost:${apiPort}`,
    `http://127.0.0.1:${apiPort}`,
    ...devUiOrigins(),
  ]);
}

export function createApiMutationGuard(allowedOrigins: ReadonlySet<string>) {
  return function apiMutationGuard(req: Request, res: Response, next: NextFunction): void {
    if (!req.path.startsWith("/api/")) {
      next();
      return;
    }

    const isContentRoute =
      req.method === "GET" && ECOSYSTEM_CONTENT_ROUTE_RE.test(req.path);
    const isMutating = MUTATING_METHODS.has(req.method);

    if (!isMutating && !isContentRoute) {
      next();
      return;
    }

    const origin = req.headers?.origin;
    if (origin !== undefined && !allowedOrigins.has(origin)) {
      res.status(403).json({ error: "Forbidden origin" });
      return;
    }

    if (isMutating) {
      const contentType = req.headers["content-type"] ?? "";
      if (!contentType.includes("application/json")) {
        res.status(415).json({ error: "Content-Type must be application/json" });
        return;
      }
    }

    next();
  };
}
