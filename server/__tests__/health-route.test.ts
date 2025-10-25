import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HealthCheckResult } from "../health";

let registerHealthRoute: (typeof import("../health"))["registerHealthRoute"];

vi.mock("../logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

beforeEach(async () => {
  vi.resetModules();
  process.env.DATABASE_URL = "postgres://test:test@localhost:5432/testdb";
  process.env.SESSION_SECRET = "test-session-secret-123";
  process.env.ENFORCE_HTTPS = "false";
  process.env.LOG_LEVEL = "silent";
  process.env.NODE_ENV = "test";

  ({ registerHealthRoute } = await import("../health"));
});

describe("registerHealthRoute", () => {
  it("returns 200 when checker reports ok", async () => {
    const app = express();
    const payload: HealthCheckResult = {
      status: "ok",
      uptimeSeconds: 10,
      timestamp: new Date().toISOString(),
      db: {
        status: "ok",
        latencyMs: 5,
        version: "PostgreSQL 16.2",
      },
    };

    registerHealthRoute(app, "/healthz", async () => payload);

    const response = await request(app).get("/healthz");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.db.version).toBe("PostgreSQL 16.2");
  });

  it("returns 500 when checker reports error", async () => {
    const app = express();
    const payload: HealthCheckResult = {
      status: "error",
      uptimeSeconds: 11,
      timestamp: new Date().toISOString(),
      db: {
        status: "error",
        message: "connection refused",
      },
    };

    registerHealthRoute(app, "/healthz", async () => payload);

    const response = await request(app).get("/healthz");
    expect(response.status).toBe(500);
    expect(response.body.status).toBe("error");
    expect(response.body.db.message).toBe("connection refused");
  });
});
