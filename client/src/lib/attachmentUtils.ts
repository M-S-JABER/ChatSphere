export const DEFAULT_ACCEPTED_TYPES: ReadonlyArray<string> = [
  "image/*",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "video/*",
  "audio/*",
  "text/plain",
  "text/csv",
  "application/json",
  "application/zip",
  "application/x-zip-compressed",
  "application/vnd.rar",
];

export type ValidateFilesOptions = {
  maxFileSizeMB?: number;
  acceptedTypes?: ReadonlyArray<string>;
  maxFiles?: number;
  currentCount?: number;
};

export type ValidationResult = {
  accepted: File[];
  rejected: Array<{ file: File; reason: string }>;
};

export const BYTES_PER_MB = 1024 * 1024;

export function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size < 0) {
    return "0 B";
  }

  if (size === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const value = size / Math.pow(1024, exponent);
  const formatted = value.toFixed(value >= 10 || exponent === 0 ? 0 : 1);
  return `${formatted.replace(/\.0$/, "")} ${units[exponent]}`;
}

export function isImage(mime: string): boolean {
  return typeof mime === "string" && mime.startsWith("image/");
}

export function validateFiles(files: File[], options: ValidateFilesOptions = {}): ValidationResult {
  const acceptedTypes = options.acceptedTypes ?? DEFAULT_ACCEPTED_TYPES;
  const maxFileSizeMB = options.maxFileSizeMB ?? 100;
  const maxFiles = options.maxFiles ?? 10;
  const currentCount = options.currentCount ?? 0;

  const accepted: File[] = [];
  const rejected: Array<{ file: File; reason: string }> = [];

  const slotsRemaining = Math.max(maxFiles - currentCount, 0);

  files.forEach((file, index) => {
    if (index >= slotsRemaining) {
      rejected.push({
        file,
        reason: `Attachment limit reached (${maxFiles}).`,
      });
      return;
    }

    const mime = file.type || "";
    const sizeInMB = file.size / BYTES_PER_MB;

    if (sizeInMB > maxFileSizeMB) {
      rejected.push({
        file,
        reason: `File exceeds ${maxFileSizeMB} MB limit.`,
      });
      return;
    }

    const isAcceptedType =
      acceptedTypes.length === 0 ||
      acceptedTypes.some((type) => {
        if (type === "*") return true;
        if (type.endsWith("/*")) {
          const prefix = type.slice(0, type.indexOf("/*"));
          return mime.startsWith(`${prefix}/`);
        }
        return mime === type;
      });

    if (!isAcceptedType) {
      rejected.push({
        file,
        reason: "Unsupported file type.",
      });
      return;
    }

    accepted.push(file);
  });

  return { accepted, rejected };
}

function stripHtml(html: string): string {
  if (!html) return "";
  return html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "");
}

export async function readDroppedText(dataTransfer: DataTransfer): Promise<string | null> {
  if (!dataTransfer) return null;

  const items = Array.from(dataTransfer.items ?? []);

  for (const item of items) {
    if (item.kind === "string") {
      const mime = item.type || "text/plain";
      const text = await new Promise<string>((resolve) => {
        item.getAsString((value) => resolve(value ?? ""));
      });

      if (!text) continue;

      if (mime === "text/html") {
        return stripHtml(text).trim() || null;
      }

      return text;
    }
  }

  // Fallback to direct data access
  const plain = dataTransfer.getData("text/plain");
  if (plain) {
    return plain;
  }

  const html = dataTransfer.getData("text/html");
  if (html) {
    return stripHtml(html);
  }

  return null;
}
