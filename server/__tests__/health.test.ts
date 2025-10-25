import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

let getHealthStatus: (typeof import("../health"))["getHealthStatus"];

beforeEach(async () => {
  vi.resetModules();
  process.env.DATABASE_URL = "postgres://test:test@localhost:5432/testdb";
  process.env.SESSION_SECRET = "test-session-secret-123";
  process.env.ENFORCE_HTTPS = "false";
  process.env.LOG_LEVEL = "silent";
  process.env.NODE_ENV = "test";

  ({ getHealthStatus } = await import("../health"));
});

describe("getHealthStatus", () => {
  it("returns ok when database responds", async () => {
    const release = vi.fn();
    const query = vi.fn().mockResolvedValue({
      rows: [{ version: "PostgreSQL 16.2" }],
    });
    const connect = vi.fn().mockResolvedValue({
      query,
      release,
    });

    const result = await getHealthStatus({ connect } as any);

    expect(connect).toHaveBeenCalled();
    expect(query).toHaveBeenCalledWith("select version()");
    expect(release).toHaveBeenCalled();
    expect(result.status).toBe("ok");
    expect(result.db.version).toContain("PostgreSQL");
    expect(result.db.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("returns error when connection throws", async () => {
    const connect = vi.fn().mockRejectedValue(new Error("connection refused"));

    const result = await getHealthStatus({ connect } as any);

    expect(result.status).toBe("error");
    expect(result.db.status).toBe("error");
    expect(result.db.message).toContain("connection refused");
  });
});
