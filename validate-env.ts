import { z } from "zod";

const booleanFromEnv = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value, ctx) => {
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true") return true;
      if (normalized === "false") return false;
    }
    if (value == null) {
      return false;
    }
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Expected boolean-like value (true/false).",
    });
    return z.NEVER;
  });

const logLevels = [
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
  "silent",
] as const;

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SESSION_SECRET: z
    .string()
    .min(16, "SESSION_SECRET must be at least 16 characters long"),
  PORT: z.coerce
    .number()
    .int()
    .min(1)
    .max(65535)
    .default(5000),
  HOST: z.string().optional(),
  LOG_LEVEL: z.enum(logLevels).default("info"),
  ENFORCE_HTTPS: booleanFromEnv,
  MEDIA_PUBLIC_BASE_URL: z.string().url().optional(),
  PUBLIC_BASE_URL: z.string().url().optional(),
  PUBLIC_APP_URL: z.string().url().optional(),
  META_TOKEN: z.string().optional(),
  META_PHONE_NUMBER_ID: z.string().optional(),
  META_VERIFY_TOKEN: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  ADMIN_USERNAME: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),
});

const parsed = EnvSchema.safeParse({
  ...process.env,
});

if (!parsed.success) {
  const formatted = parsed.error.flatten();
  const details = Object.entries(formatted.fieldErrors)
    .map(([key, messages]) => `${key}: ${messages?.join(", ")}`)
    .join("\n  ");

  console.error(
    "Invalid environment configuration. Please review the following issues:\n  %s",
    details,
  );

  throw new Error("Invalid environment variables. See logs for more details.");
}

export const env = parsed.data;
