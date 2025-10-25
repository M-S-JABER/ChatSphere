import express, { type Request, Response, NextFunction } from "express";
import { mkdirSync } from "fs";
import { join } from "path";
import { env } from "../validate-env";
import { registerRoutes } from "./routes";
import { setupAuth } from "./auth";
import { setupVite, serveStatic } from "./vite";
import { httpLogger, logger } from "./logger";
import { registerHealthRoute } from "./health";
import { assertSigningSecret } from "./lib/signedUrl";

// Ensure uploads directory exists
try {
  mkdirSync(join(process.cwd(), "uploads"), { recursive: true });
} catch (error) {
  // Directory already exists, ignore
}

const app = express();

process.env.NODE_ENV = env.NODE_ENV;
app.set("env", env.NODE_ENV);

app.set("trust proxy", true);
app.use(httpLogger);

assertSigningSecret();

const enforceHttps = env.ENFORCE_HTTPS ?? false;

if (enforceHttps) {
  app.use((req, res, next) => {
    const forwardedProto = req.get("x-forwarded-proto");
    const primaryProto = forwardedProto?.split(",")[0]?.trim().toLowerCase();
    const isHttps = req.secure || primaryProto === "https";
    const upgradeHeader = req.get("upgrade");

    if (isHttps || (upgradeHeader && upgradeHeader.toLowerCase() === "websocket")) {
      return next();
    }

    const host = req.get("host");
    if (!host) {
      return next();
    }

    return res.redirect(301, `https://${host}${req.originalUrl}`);
  });
}

app.use(express.json({
  verify: (req: any, res, buf) => {
    if (req.path.startsWith('/webhook/')) {
      req.rawBody = buf.toString('utf8');
    }
  }
}));

app.use(express.urlencoded({ 
  extended: false,
  verify: (req: any, res, buf) => {
    if (req.path.startsWith('/webhook/')) {
      req.rawBody = buf.toString('utf8');
    }
  }
}));

registerHealthRoute(app);

const { requireAdmin } = setupAuth(app);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      const responsePreview = capturedJsonResponse
        ? JSON.stringify(capturedJsonResponse).slice(0, 200)
        : undefined;

      logger.info(
        {
          event: "api_request_completed",
          requestId: res.getHeader("x-request-id") ?? undefined,
          method: req.method,
          path,
          statusCode: res.statusCode,
          durationMs: duration,
          responsePreview,
        },
        "API request completed",
      );
    }
  });

  next();
});

(async () => {
  // Ensure DB schema is present before registering routes that depend on it
  const { ensureSchema } = await import('./db');
  await ensureSchema();
  const server = await registerRoutes(app, requireAdmin);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    // Handle Multer errors
    if (err.name === "MulterError") {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "File too large. Maximum size is 10MB." });
      }
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return res.status(400).json({ error: "Unexpected file field." });
      }
      return res.status(400).json({ error: err.message });
    }

    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = env.PORT;
  const host = env.HOST ?? "0.0.0.0";
  server.listen({
    port,
    host,
    reusePort: true,
  }, () => {
    logger.info(
      { event: "server_started", port, host },
      `Serving on http://${host}:${port}`,
    );
  });
})();
