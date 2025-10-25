import crypto from "crypto";
import type { Request } from "express";

type SignatureValidationResult =
  | { valid: true }
  | { valid: false; status: number; message: string };

const SIGNING_SECRET = process.env.FILES_SIGNING_SECRET;

const REQUIRE_SIGNED_URL = (() => {
  const explicit = process.env.REQUIRE_SIGNED_URL;
  if (explicit != null) {
    return String(explicit).toLowerCase() === "true";
  }
  return Boolean(SIGNING_SECRET);
})();

export function assertSigningSecret(): void {
  if (REQUIRE_SIGNED_URL && !SIGNING_SECRET) {
    throw new Error("FILES_SIGNING_SECRET must be set when REQUIRE_SIGNED_URL=true");
  }
}

export function isSignedUrlRequired(): boolean {
  return REQUIRE_SIGNED_URL;
}

export function createSignature(path: string, expiresAt: number): string {
  if (!SIGNING_SECRET) {
    throw new Error("FILES_SIGNING_SECRET is required to generate signatures");
  }

  const hmac = crypto.createHmac("sha256", SIGNING_SECRET);
  hmac.update(path);
  hmac.update(":");
  hmac.update(String(expiresAt));
  return hmac.digest("hex");
}

export function verifySignedUrl(req: Request): SignatureValidationResult {
  if (!REQUIRE_SIGNED_URL) {
    return { valid: true };
  }

  const { signature, expires } = req.query;
  if (typeof signature !== "string" || typeof expires !== "string") {
    return { valid: false, status: 401, message: "Missing signature parameters." };
  }

  const expiresAt = Number(expires);
  if (!Number.isFinite(expiresAt)) {
    return { valid: false, status: 400, message: "Invalid expiration parameter." };
  }

  if (expiresAt * 1000 < Date.now()) {
    return { valid: false, status: 401, message: "Signed URL has expired." };
  }

  if (!SIGNING_SECRET) {
    return { valid: false, status: 500, message: "Signing secret not configured." };
  }

  const normalizedPath = req.path;
  const expectedSignature = createSignature(normalizedPath, expiresAt);

  const providedBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return { valid: false, status: 403, message: "Invalid signed URL signature." };
  }

  return { valid: true };
}

export function buildSignedPath(path: string, ttlSeconds: number): string {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const url = new URL(path, "https://placeholder.local");
  const canonicalPath = url.pathname;
  const signature = createSignature(canonicalPath, expiresAt);
  url.searchParams.set("expires", String(expiresAt));
  url.searchParams.set("signature", signature);
  return url.pathname + url.search;
}
