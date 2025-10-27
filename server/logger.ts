import { randomUUID } from "crypto";
import pino from "pino";
import pinoHttp from "pino-http";
import { env } from "../validate-env";

const isProduction = env.NODE_ENV === "production";

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "chatsphere" },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(isProduction
    ? {}
    : {
        formatters: {
          level(label) {
            return { level: label };
          },
        },
      }),
});

export const httpLogger = pinoHttp({
  logger,
  customLogLevel: (req, res, err) => {
    if (req.url === '/health') return 'silent'
    if (res.statusCode >= 400 && res.statusCode < 500) return 'warn'
    if (res.statusCode >= 500 || err) return 'error'
    return 'info'
  },
  genReqId: (req, res) => {
    const headerRequestId =
      req.headers["x-request-id"] ||
      req.headers["x-correlation-id"] ||
      req.headers["x-amzn-trace-id"];

    if (typeof headerRequestId === "string" && headerRequestId.length > 0) {
      res.setHeader("x-request-id", headerRequestId);
      return headerRequestId;
    }

    const id = randomUUID();
    res.setHeader("x-request-id", id);
    return id;
  },
  customProps: (req) => ({
    requestPath: req.url,
  }),
});
