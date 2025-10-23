const DEFAULT_MIME = "application/octet-stream";
export const MIME_MAP: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  wav: "audio/wav",
};
export function getMimeType(filenameOrExt: string): string {
  const normalized = filenameOrExt.trim().toLowerCase();
  if (!normalized) {
    return DEFAULT_MIME;
  }
  const ext = normalized.includes(".")
    ? normalized.substring(normalized.lastIndexOf(".") + 1)
    : normalized;
  return MIME_MAP[ext] ?? DEFAULT_MIME;
}
export function isSupportedExtension(extOrFilename: string): boolean {
  const normalized = extOrFilename.trim().toLowerCase();
  if (!normalized) return false;
  const ext = normalized.includes(".")
    ? normalized.substring(normalized.lastIndexOf(".") + 1)
    : normalized;
  return Object.prototype.hasOwnProperty.call(MIME_MAP, ext);
}
