import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";
import type { Message, MessageMedia } from "@shared/schema";
import type { IncomingMediaDescriptor } from "../providers/base";
import type { MetaMediaMetadata, MetaProvider } from "../providers/meta";
import { logger } from "../logger";
import { storage } from "../storage";
import {
  buildMediaFileName,
  buildSignedMediaPath,
  ensureMediaDirectories,
  resolveAbsoluteMediaPath,
  toRelativeMediaPath,
  toUrlPath,
} from "./media-storage";
import { getExtensionFromMime, getMimeTypeFromExtension, normalizeMimeType } from "../lib/mime";

const MAX_DOWNLOAD_ATTEMPTS = Number(process.env.MEDIA_DOWNLOAD_MAX_ATTEMPTS ?? 3);
const RETRY_DELAY_MS = Number(process.env.MEDIA_DOWNLOAD_RETRY_DELAY_MS ?? 750);
const MAX_ORIGINAL_BYTES = Number(process.env.MEDIA_MAX_ORIGINAL_BYTES ?? 25 * 1024 * 1024);
const THUMB_MAX_WIDTH = Number(process.env.MEDIA_THUMBNAIL_MAX_WIDTH ?? 512);
const THUMB_MAX_HEIGHT = Number(process.env.MEDIA_THUMBNAIL_MAX_HEIGHT ?? 512);

const MEDIA_TYPES_WITH_THUMBNAILS = new Set(["image", "video", "document"]);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type WhatsappMediaIngestOptions = {
  messageId: string;
  conversationId: string;
  descriptor: IncomingMediaDescriptor;
  provider: MetaProvider;
  onStatusChange?: (message: Message | undefined) => void | Promise<void>;
};

export async function ingestWhatsappMedia({
  messageId,
  conversationId,
  descriptor,
  provider,
  onStatusChange,
}: WhatsappMediaIngestOptions): Promise<void> {
  ensureMediaDirectories();

  const message = await storage.getMessageById(messageId);
  if (!message) {
    logger.warn(
      { messageId, conversationId },
      "ingestWhatsappMedia: message no longer exists, aborting.",
    );
    return;
  }

  const existingMedia = (message.media as MessageMedia | null) ?? null;
  const workingMedia = mergeMedia(existingMedia, descriptor);

  await persistAndNotify(messageId, workingMedia, onStatusChange);

  try {
    const metadata = await fetchMediaMetadataWithRetry(provider, descriptor.mediaId, workingMedia);

    const effectiveMimeType =
      normalizeMimeType(descriptor.mimeType) ??
      normalizeMimeType(metadata?.mime_type) ??
      workingMedia.mimeType ??
      "application/octet-stream";

    const declaredSize = descriptor.sizeBytes ?? metadata?.file_size ?? existingMedia?.sizeBytes;

    if (declaredSize && declaredSize > MAX_ORIGINAL_BYTES) {
      throw new Error(
        `Media exceeds configured size limit (${declaredSize} bytes > ${MAX_ORIGINAL_BYTES})`,
      );
    }

    const downloadResult = await downloadMediaWithRetry(provider, metadata?.url ?? descriptor.url);
    const buffer = downloadResult.buffer;

    if (!buffer?.length) {
      throw new Error("Downloaded media is empty.");
    }

    if (buffer.length > MAX_ORIGINAL_BYTES) {
      throw new Error(
        `Downloaded media exceeds configured size limit (${buffer.length} bytes > ${MAX_ORIGINAL_BYTES})`,
      );
    }

    const extension =
      workingMedia.extension ??
      getExtensionFromMime(effectiveMimeType) ??
      getExtensionFromMime(downloadResult.contentType) ??
      getExtensionFromMime(metadata?.mime_type) ??
      guessExtensionFromFileName(descriptor.filename) ??
      "bin";

    const sanitizedFileName = buildMediaFileName({
      mediaId: descriptor.mediaId ?? metadata?.id ?? message.providerMessageId ?? messageId,
      originalFileName: descriptor.filename ?? metadata?.name ?? existingMedia?.filename ?? null,
      extension,
      prefix: descriptor.type ?? workingMedia.type ?? "media",
    });

    const relativeOriginalPath = toRelativeMediaPath([
      "incoming",
      "original",
      sanitizedFileName,
    ]);
    const absoluteOriginalPath = resolveAbsoluteMediaPath(relativeOriginalPath);

    await fs.writeFile(absoluteOriginalPath, buffer);

    let thumbnailRelativePath: string | null = null;
    let previewRelativePath: string | null = null;
    let measuredWidth = workingMedia.width ?? null;
    let measuredHeight = workingMedia.height ?? null;
    let pageCount = workingMedia.pageCount ?? null;

    if (MEDIA_TYPES_WITH_THUMBNAILS.has(workingMedia.type)) {
      const thumbInfo = await generateThumbnail({
        buffer,
        type: workingMedia.type,
        mimeType: effectiveMimeType,
        baseFileName: sanitizedFileName,
      });

      if (thumbInfo) {
        thumbnailRelativePath = thumbInfo.thumbnailRelativePath;
        previewRelativePath = thumbInfo.previewRelativePath;
        measuredWidth = thumbInfo.width ?? measuredWidth;
        measuredHeight = thumbInfo.height ?? measuredHeight;
        pageCount = thumbInfo.pageCount ?? pageCount;
      }
    }

    const finalMedia: MessageMedia = {
      ...workingMedia,
      status: "ready",
      mimeType: effectiveMimeType,
      filename: sanitizedFileName,
      extension,
      sizeBytes: buffer.length,
      checksum: metadata?.sha256 ?? workingMedia.checksum ?? null,
      width: measuredWidth,
      height: measuredHeight,
      pageCount,
      storage: {
        ...(workingMedia.storage ?? {}),
        originalPath: relativeOriginalPath,
        thumbnailPath: thumbnailRelativePath,
        previewPath: previewRelativePath,
      },
      url: toUrlPath(relativeOriginalPath),
      thumbnailUrl: thumbnailRelativePath ? toUrlPath(thumbnailRelativePath) : workingMedia.thumbnailUrl ?? null,
      previewUrl: previewRelativePath ? toUrlPath(previewRelativePath) : workingMedia.previewUrl ?? null,
      downloadedAt: new Date().toISOString(),
      thumbnailGeneratedAt: thumbnailRelativePath ? new Date().toISOString() : workingMedia.thumbnailGeneratedAt ?? null,
      downloadError: null,
      metadata: {
        ...(workingMedia.metadata ?? {}),
        whatsapp: {
          ...(workingMedia.metadata?.whatsapp ?? {}),
          ...descriptor.metadata,
        },
        provider: metadata,
      },
    };

    await persistAndNotify(messageId, finalMedia, onStatusChange);
  } catch (error: any) {
    const failedMedia: MessageMedia = {
      ...workingMedia,
      status: "failed",
      downloadError: error?.message ?? "Unknown media ingestion error.",
    };

    logger.error(
      {
        err: error,
        conversationId,
        messageId,
        mediaId: descriptor.mediaId,
        providerMessageId: message.providerMessageId,
        mimeType: descriptor.mimeType,
      },
      "Failed to ingest WhatsApp media.",
    );

    await persistAndNotify(messageId, failedMedia, onStatusChange);
  }
}

type ThumbnailGeneratorInput = {
  buffer: Buffer;
  mimeType: string;
  type: string;
  baseFileName: string;
};

type ThumbnailResult = {
  thumbnailRelativePath: string;
  previewRelativePath: string | null;
  width?: number | null;
  height?: number | null;
  pageCount?: number | null;
};

async function generateThumbnail({
  buffer,
  mimeType,
  type,
  baseFileName,
}: ThumbnailGeneratorInput): Promise<ThumbnailResult | null> {
  if (!buffer.length) return null;

  const extension = getExtensionFromMime(mimeType) ?? guessExtensionFromFileName(baseFileName);

  if (type === "image" || (type === "document" && extension === "pdf")) {
    const sharpInstance =
      type === "document" && extension === "pdf"
        ? sharp(buffer, { density: 160, pages: 1 })
        : sharp(buffer);

    const basicMeta = await sharpInstance.metadata();
    const resized = await sharpInstance
      .clone()
      .rotate()
      .resize({
        width: THUMB_MAX_WIDTH,
        height: THUMB_MAX_HEIGHT,
        fit: "inside",
        withoutEnlargement: true,
      })
      .toFormat("webp", { quality: 80 });

    const thumbBuffer = await resized.toBuffer();

    const thumbName = buildMediaFileName({
      originalFileName: `${baseFileName}-thumb.webp`,
      prefix: "thumb",
      extension: "webp",
    });
    const relativeThumbPath = toRelativeMediaPath(["incoming", "thumbnails", thumbName]);
    const absoluteThumbPath = resolveAbsoluteMediaPath(relativeThumbPath);
    await fs.writeFile(absoluteThumbPath, thumbBuffer);

    return {
      thumbnailRelativePath: relativeThumbPath,
      previewRelativePath: relativeThumbPath,
      width: basicMeta.width ?? null,
      height: basicMeta.height ?? null,
      pageCount: type === "document" ? 1 : null,
    };
  }

  return null;
}

async function fetchMediaMetadataWithRetry(
  provider: MetaProvider,
  mediaId: string | undefined,
  workingMedia: MessageMedia,
): Promise<MetaMediaMetadata | null> {
  if (!mediaId) {
    return null;
  }

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_DOWNLOAD_ATTEMPTS; attempt++) {
    try {
      const metadata = await provider.fetchMediaMetadata(mediaId);
      return metadata;
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.warn(
        {
          mediaId,
          attempt,
          maxAttempts: MAX_DOWNLOAD_ATTEMPTS,
          error: lastError.message,
          providerMediaId: workingMedia.providerMediaId,
        },
        "Failed to fetch media metadata, will retry if attempts remain.",
      );

      if (attempt < MAX_DOWNLOAD_ATTEMPTS) {
        await delay(RETRY_DELAY_MS * attempt);
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  return null;
}

async function downloadMediaWithRetry(
  provider: MetaProvider,
  downloadUrl: string | undefined,
): Promise<{ buffer: Buffer; contentType?: string | null }> {
  if (!downloadUrl) {
    throw new Error("No media download URL available.");
  }

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_DOWNLOAD_ATTEMPTS; attempt++) {
    try {
      return await provider.downloadMedia(downloadUrl);
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.warn(
        {
          attempt,
          maxAttempts: MAX_DOWNLOAD_ATTEMPTS,
          error: lastError.message,
        },
        "Failed to download media content, will retry if attempts remain.",
      );

      if (attempt < MAX_DOWNLOAD_ATTEMPTS) {
        await delay(RETRY_DELAY_MS * attempt);
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error("Media download failed.");
}

async function persistAndNotify(
  messageId: string,
  media: MessageMedia,
  onStatusChange?: (message: Message | undefined) => void | Promise<void>,
): Promise<void> {
  await storage.updateMessageMedia(messageId, media);

  if (onStatusChange) {
    const updated = await storage.getMessageById(messageId);
    await onStatusChange(updated);
  }
}

function mergeMedia(existing: MessageMedia | null, descriptor: IncomingMediaDescriptor): MessageMedia {
  return {
    origin: existing?.origin ?? "whatsapp",
    type: descriptor.type ?? existing?.type ?? "unknown",
    status: "processing",
    provider: descriptor.provider ?? existing?.provider ?? "meta",
    providerMediaId: descriptor.mediaId ?? existing?.providerMediaId ?? null,
    mimeType: normalizeMimeType(descriptor.mimeType) ?? existing?.mimeType ?? null,
    filename: existing?.filename ?? descriptor.filename ?? null,
    extension: existing?.extension ?? null,
    sizeBytes: descriptor.sizeBytes ?? existing?.sizeBytes ?? null,
    checksum: descriptor.sha256 ?? existing?.checksum ?? null,
    width: descriptor.width ?? existing?.width ?? null,
    height: descriptor.height ?? existing?.height ?? null,
    durationSeconds: descriptor.durationSeconds ?? existing?.durationSeconds ?? null,
    pageCount: descriptor.pageCount ?? existing?.pageCount ?? null,
    url: existing?.url ?? null,
    thumbnailUrl: existing?.thumbnailUrl ?? null,
    previewUrl: existing?.previewUrl ?? null,
    placeholderUrl: existing?.placeholderUrl ?? null,
    storage: existing?.storage ?? null,
    downloadAttempts: (existing?.downloadAttempts ?? 0) + 1,
    downloadError: null,
    downloadedAt: existing?.downloadedAt ?? null,
    thumbnailGeneratedAt: existing?.thumbnailGeneratedAt ?? null,
    metadata: {
      ...(existing?.metadata ?? {}),
      whatsapp: descriptor.metadata ?? existing?.metadata?.whatsapp ?? null,
    },
  };
}

function guessExtensionFromFileName(filename?: string | null): string | null {
  if (!filename) return null;
  const normalized = filename.split(".").pop();
  if (!normalized) return null;
  return normalized.trim().toLowerCase() || null;
}

export function buildSignedMediaUrlsForMessage<T extends Message>(
  message: T,
  ttlSeconds?: number,
): T {
  if (!message.media) {
    return message;
  }

  const media = message.media;
  const signedMedia: MessageMedia = {
    ...media,
  };

  if (media.storage?.originalPath) {
    signedMedia.url = buildSignedMediaPath(media.storage.originalPath, ttlSeconds);
  } else if (media.url) {
    const normalized = media.url.replace(/^\/+/, "");
    signedMedia.url = buildSignedMediaPath(normalized, ttlSeconds);
  }

  if (media.storage?.thumbnailPath) {
    signedMedia.thumbnailUrl = buildSignedMediaPath(media.storage.thumbnailPath, ttlSeconds);
  } else if (media.thumbnailUrl) {
    const normalized = media.thumbnailUrl.replace(/^\/+/, "");
    signedMedia.thumbnailUrl = buildSignedMediaPath(normalized, ttlSeconds);
  }

  if (media.storage?.previewPath) {
    signedMedia.previewUrl = buildSignedMediaPath(media.storage.previewPath, ttlSeconds);
  } else if (media.previewUrl) {
    const normalized = media.previewUrl.replace(/^\/+/, "");
    signedMedia.previewUrl = buildSignedMediaPath(normalized, ttlSeconds);
  }

  return {
    ...message,
    media: signedMedia,
  };
}
