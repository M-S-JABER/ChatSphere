import type { Express } from "express";
import { logger } from "./logger";
import { pool } from "./db";

type PoolClient = {
  query<T = any>(queryText: string): Promise<{ rows: T[] }>;
  release(): void;
};

type PoolLike = {
  connect(): Promise<PoolClient>;
};

export type HealthCheckResult = {
  status: "ok" | "error";
  uptimeSeconds: number;
  timestamp: string;
  db: {
    status: "ok" | "error";
    latencyMs?: number;
    version?: string | null;
    message?: string;
  };
};

export async function getHealthStatus(dbPool: PoolLike = pool): Promise<HealthCheckResult> {
  const startedAt = Date.now();
  const uptimeSeconds = Math.floor(process.uptime());
  let client: PoolClient | null = null;

  try {
    client = await dbPool.connect();
    const result = await client.query<{ version: string }>("select version()");
    const dbVersion = result.rows?.[0]?.version ?? null;

    return {
      status: "ok",
      uptimeSeconds,
      timestamp: new Date().toISOString(),
      db: {
        status: "ok",
        version: dbVersion,
        latencyMs: Date.now() - startedAt,
      },
    };
  } catch (error: any) {
    logger.error({ err: error }, "health check failed");

    return {
      status: "error",
      uptimeSeconds,
      timestamp: new Date().toISOString(),
      db: {
        status: "error",
        message: error?.message ?? "Unknown error",
      },
    };
  } finally {
    client?.release();
  }
}

export function registerHealthRoute(
  app: Express,
  path = "/health",
  checker: () => Promise<HealthCheckResult> = getHealthStatus,
): void {
  app.get(path, async (_req, res) => {
    const result = await checker();
    res.status(result.status === "ok" ? 200 : 500).json(result);
  });
}
