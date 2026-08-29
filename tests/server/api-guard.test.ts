import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import {
  buildAllowedApiOrigins,
  createApiMutationGuard,
} from "../../src/server/middleware/api-guard.js";

function mockResponse() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as Response & { statusCode: number; body: unknown };
}

function runGuard(
  req: Partial<Request>,
  allowedOrigins = buildAllowedApiOrigins(3847),
) {
  const guard = createApiMutationGuard(allowedOrigins);
  const res = mockResponse();
  const next = vi.fn() as NextFunction;
  guard(req as Request, res, next);
  return { res, next };
}

describe("api mutation guard", () => {
  it("allows GET without Origin or Content-Type", () => {
    const { next, res } = runGuard({ method: "GET", path: "/api/project" });
    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
  });

  it("allows POST with no Origin and application/json", () => {
    const { next } = runGuard({
      method: "POST",
      path: "/api/project/scan",
      headers: { "content-type": "application/json" },
    });
    expect(next).toHaveBeenCalledOnce();
  });

  it("rejects POST from a foreign Origin", () => {
    const { next, res } = runGuard({
      method: "POST",
      path: "/api/project/browse",
      headers: {
        origin: "https://evil.example",
        "content-type": "application/json",
      },
    });
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: "Forbidden origin" });
  });

  it("rejects POST without application/json Content-Type", () => {
    const { next, res } = runGuard({
      method: "POST",
      path: "/api/project/browse",
      headers: {},
    });
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(415);
    expect(res.body).toEqual({ error: "Content-Type must be application/json" });
  });

  it("allows vite dev Origin on port 5173", () => {
    const { next } = runGuard({
      method: "POST",
      path: "/api/project/browse",
      headers: {
        origin: "http://localhost:5173",
        "content-type": "application/json",
      },
    });
    expect(next).toHaveBeenCalledOnce();
  });
});
