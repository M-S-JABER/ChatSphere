const DEFAULT_MIME = "application/octet-stream";

export const MIME_MAP: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  m4v: "video/mp4",
  webm: "video/webm",
  avi: "video/x-msvideo",
  mkv: "video/x-matroska",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  zip: "application/zip",
  rar: "application/vnd.rar",
  "7z": "application/x-7z-compressed",
};

const EXTENSION_MAP: Record<string, string> = {};
Object.entries(MIME_MAP).forEach(([ext, mime]) => {
  EXTENSION_MAP[normalizeMimeType(mime) ?? mime] = ext;
});

function normalizeExtension(input: string): string {
  const normalized = input.trim().toLowerCase();
  return normalized.includes(".")
    ? normalized.substring(normalized.lastIndexOf(".") + 1)
    : normalized;
}

export function normalizeMimeType(mime?: string | null): string | null {
  if (!mime) {
    return null;
  }
  const normalized = mime.trim().toLowerCase();
  return normalized || null;
}

export function getMimeType(filenameOrExt: string): string {
  const normalizedExt = normalizeExtension(filenameOrExt);
  return MIME_MAP[normalizedExt] ?? DEFAULT_MIME;
}

export function getMimeTypeFromExtension(filenameOrExt: string | null | undefined): string | null {
  if (!filenameOrExt) return null;
  const normalizedExt = normalizeExtension(filenameOrExt);
  return MIME_MAP[normalizedExt] ?? null;
}

export function getExtensionFromMime(mime?: string | null): string | null {
  const normalizedMime = normalizeMimeType(mime);
  if (!normalizedMime) return null;
  if (EXTENSION_MAP[normalizedMime]) {
    return EXTENSION_MAP[normalizedMime];
  }
  const entry = Object.entries(MIME_MAP).find(
    ([, value]) => normalizeMimeType(value) === normalizedMime,
  );
  return entry?.[0] ?? null;
}

export function isSupportedExtension(extOrFilename: string): boolean {
  const normalizedExt = normalizeExtension(extOrFilename);
  return Object.prototype.hasOwnProperty.call(MIME_MAP, normalizedExt);
}
