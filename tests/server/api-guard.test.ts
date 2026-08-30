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

  it("rejects ecosystem content GET from a foreign Origin", () => {
    const { next, res } = runGuard({
      method: "GET",
      path: "/api/ecosystem/resource/claude:agent:backend/content",
      headers: { origin: "https://evil.example" },
    });
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: "Forbidden origin" });
  });

  it("allows ecosystem content GET without Origin", () => {
    const { next } = runGuard({
      method: "GET",
      path: "/api/ecosystem/resource/claude:agent:backend/content",
      headers: {},
    });
    expect(next).toHaveBeenCalledOnce();
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

  it("allows vite dev Origin from VITE_PORT env", () => {
    const original = process.env.VITE_PORT;
    process.env.VITE_PORT = "5174";
    try {
      const origins = buildAllowedApiOrigins(3847);
      const guard = createApiMutationGuard(origins);
      const res = mockResponse();
      const next = vi.fn() as NextFunction;
      guard(
        {
          method: "POST",
          path: "/api/project/browse",
          headers: {
            origin: "http://localhost:5174",
            "content-type": "application/json",
          },
        } as Request,
        res,
        next,
      );
      expect(next).toHaveBeenCalledOnce();
    } finally {
      if (original === undefined) {
        delete process.env.VITE_PORT;
      } else {
        process.env.VITE_PORT = original;
      }
    }
  });

  it("allows custom CAPSIGHT_DEV_ORIGIN", () => {
    const original = process.env.CAPSIGHT_DEV_ORIGIN;
    process.env.CAPSIGHT_DEV_ORIGIN = "http://127.0.0.1:3000";
    try {
      const origins = buildAllowedApiOrigins(3847);
      expect(origins.has("http://127.0.0.1:3000")).toBe(true);
    } finally {
      if (original === undefined) {
        delete process.env.CAPSIGHT_DEV_ORIGIN;
      } else {
        process.env.CAPSIGHT_DEV_ORIGIN = original;
      }
    }
  });
});
