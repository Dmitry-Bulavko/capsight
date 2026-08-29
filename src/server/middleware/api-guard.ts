import type { NextFunction, Request, Response } from "express";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function buildAllowedApiOrigins(port: number): ReadonlySet<string> {
  return new Set([
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ]);
}

export function createApiMutationGuard(allowedOrigins: ReadonlySet<string>) {
  return function apiMutationGuard(req: Request, res: Response, next: NextFunction): void {
    if (!req.path.startsWith("/api/") || !MUTATING_METHODS.has(req.method)) {
      next();
      return;
    }

    const origin = req.headers.origin;
    if (origin !== undefined && !allowedOrigins.has(origin)) {
      res.status(403).json({ error: "Forbidden origin" });
      return;
    }

    const contentType = req.headers["content-type"] ?? "";
    if (!contentType.includes("application/json")) {
      res.status(415).json({ error: "Content-Type must be application/json" });
      return;
    }

    next();
  };
}
