import crypto from "crypto";
import { mkdirSync } from "fs";
import path from "path";
import { buildSignedPath, isSignedUrlRequired } from "../lib/signedUrl";

const configuredRoot = process.env.MEDIA_STORAGE_ROOT;

const MEDIA_ROOT = configuredRoot
  ? path.isAbsolute(configuredRoot)
    ? configuredRoot
    : path.join(process.cwd(), configuredRoot)
  : path.join(process.cwd(), "uploads");

const MEDIA_ROUTE_PREFIX = "/media";
const DEFAULT_SIGNED_URL_TTL_SECONDS = Number(
  process.env.MEDIA_SIGNED_URL_TTL_SECONDS ?? process.env.MEDIA_SIGNED_URL_TTL ?? 900,
);

const ensuredDirectories = new Set<string>();

const REQUIRED_DIRECTORIES = [
  "",
  "incoming",
  path.join("incoming", "original"),
  path.join("incoming", "thumbnails"),
  path.join("incoming", "previews"),
  "outbound",
  path.join("outbound", "original"),
  path.join("outbound", "thumbnails"),
  "cache",
];

function ensureDirectory(relativePath: string): void {
  const absolutePath = path.join(MEDIA_ROOT, relativePath);

  if (ensuredDirectories.has(absolutePath)) {
    return;
  }

  mkdirSync(absolutePath, { recursive: true });
  ensuredDirectories.add(absolutePath);
}

export function ensureMediaDirectories(): void {
  REQUIRED_DIRECTORIES.forEach((relativeDir) => {
    ensureDirectory(relativeDir);
  });
}

export function getMediaRoot(): string {
  ensureMediaDirectories();
  return MEDIA_ROOT;
}

export function getMediaRoutePrefix(): string {
  return MEDIA_ROUTE_PREFIX;
}

export function resolveAbsoluteMediaPath(relativePath: string): string {
  const normalizedRelative = relativePath.replace(/^\/+/, "");
  const absolutePath = path.resolve(MEDIA_ROOT, normalizedRelative);

  if (!absolutePath.startsWith(path.resolve(MEDIA_ROOT))) {
    throw new Error("Attempted to resolve media path outside of root");
  }

  return absolutePath;
}

export function toRelativeMediaPath(parts: string[]): string {
  return parts
    .join("/")
    .split("/")
    .filter(Boolean)
    .join("/");
}

export function toUrlPath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  return `${MEDIA_ROUTE_PREFIX}/${normalized}`;
}

export function buildSignedMediaPath(
  relativePath: string,
  ttlSeconds: number = DEFAULT_SIGNED_URL_TTL_SECONDS,
): string {
  const normalizedRelative = relativePath.replace(/^\/+/, "");
  const unsignedPath = toUrlPath(normalizedRelative);

  if (!isSignedUrlRequired()) {
    return unsignedPath;
  }

  return buildSignedPath(unsignedPath, ttlSeconds);
}

export function sanitizeFileName(filename: string, fallbackBase: string): string {
  const base = filename?.split("/").pop() ?? fallbackBase;
  const normalized = base
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\./, "")
    .toLowerCase();

  return normalized || `${fallbackBase}-${crypto.randomUUID()}`;
}

export function buildMediaFileName(options: {
  mediaId?: string | null;
  originalFileName?: string | null;
  extension?: string | null;
  prefix?: string | null;
}): string {
  const extension = (options.extension ?? options.originalFileName?.split(".").pop() ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  const safeExtension = extension ? `.${extension}` : "";
  const prefix = options.prefix ?? "media";

  if (options.originalFileName) {
    const sanitized = sanitizeFileName(options.originalFileName, prefix);
    if (safeExtension && !sanitized.endsWith(safeExtension)) {
      return `${sanitized.replace(/\.[^.]+$/, "")}${safeExtension}`;
    }
    return sanitized;
  }

  if (options.mediaId) {
    return `${prefix}-${options.mediaId}${safeExtension}`;
  }

  return `${prefix}-${Date.now()}-${crypto.randomUUID()}${safeExtension}`;
}

export function extractRelativeMediaPath(inputUrl: string): string | null {
  if (!inputUrl) return null;

  try {
    const parsed = new URL(inputUrl, "https://placeholder.local");
    const pathname = parsed.pathname ?? "";
    if (!pathname.startsWith(MEDIA_ROUTE_PREFIX)) {
      return null;
    }
    return pathname.substring(MEDIA_ROUTE_PREFIX.length).replace(/^\/+/, "");
  } catch {
    if (inputUrl.startsWith(MEDIA_ROUTE_PREFIX)) {
      return inputUrl.substring(MEDIA_ROUTE_PREFIX.length).replace(/^\/+/, "");
    }
    return null;
  }
}
