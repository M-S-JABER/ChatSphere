import multer from "multer";
import path from "path";
import {
  buildMediaFileName,
  ensureMediaDirectories,
  resolveAbsoluteMediaPath,
} from "./media-storage";

export const MAX_UPLOAD_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

const ALLOWED_MIME_PREFIXES = ["image/", "video/", "audio/"] as const;

export const ALLOWED_MIME_TYPES = new Set<string>([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel.sheet.macroenabled.12",
  "text/plain",
  "text/csv",
  "application/json",
  "application/zip",
  "application/x-zip-compressed",
  "application/x-7z-compressed",
  "application/vnd.rar",
]);

const ALLOWED_EXTENSIONS = new Set<string>([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".txt",
  ".csv",
  ".json",
  ".zip",
  ".rar",
  ".7z",
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      ensureMediaDirectories();
      const targetDir = resolveAbsoluteMediaPath(path.join("outbound", "original"));
      cb(null, targetDir);
    } catch (error) {
      cb(error as Error, "");
    }
  },
  filename: (_req, file, cb) => {
    const uniqueName = buildMediaFileName({
      originalFileName: `${Date.now()}-${file.originalname}`,
      prefix: "upload",
    });
    cb(null, uniqueName);
  },
});

const isAllowedMime = (mime: string | undefined) => {
  if (!mime) return false;
  const normalized = mime.toLowerCase();
  if (ALLOWED_MIME_TYPES.has(normalized)) {
    return true;
  }
  return ALLOWED_MIME_PREFIXES.some((prefix) => normalized.startsWith(prefix));
};

const isAllowedExtension = (filename: string | undefined) => {
  if (!filename) return false;
  const ext = path.extname(filename).toLowerCase();
  if (!ext) return false;
  return ALLOWED_EXTENSIONS.has(ext);
};

export const upload = multer({
  storage,
  limits: {
    fileSize: MAX_UPLOAD_FILE_SIZE_BYTES,
  },
  fileFilter: (_req, file, cb) => {
    if (isAllowedMime(file.mimetype) || isAllowedExtension(file.originalname)) {
      cb(null, true);
      return;
    }
    const error = new Error("Unsupported file type.") as Error & { status?: number };
    error.status = 400;
    cb(error);
  },
});

export type UploadMiddleware = typeof upload;
