import type { ChatMessage } from "@/types/messages";
import type { MessageMedia } from "@shared/schema";
import { format } from "date-fns";
import {
  Check,
  CheckCheck,
  File,
  FileArchive,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  Download,
  FileText,
  FileVideo,
  Loader2,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

interface MessageBubbleProps {
  message: ChatMessage;
  canDelete?: boolean;
  onDelete?: () => void;
  isDeleting?: boolean;
  onReply?: (message: ChatMessage) => void;
  onScrollToMessage?: (messageId: string) => void;
}

const getReplyLabel = (direction: string) => (direction === "inbound" ? "Customer" : "Agent");

const getSnippet = (body: string | null | undefined) => {
  if (!body) return "[Original message unavailable]";
  const trimmed = body.trim();
  return trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed;
};

const formatFileSize = (bytes?: number | null): string => {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) {
    return "";
  }

  const units = ["bytes", "KB", "MB", "GB", "TB"] as const;
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  if (unitIndex === 0) {
    return `${Math.round(value)} ${units[unitIndex]}`;
  }

  return `${value.toFixed(1)} ${units[unitIndex]}`;
};

const getMediaDisplayName = (media: MessageMedia): string => {
  if (media.filename?.trim()) {
    return media.filename.trim();
  }

  if (media.extension) {
    return `attachment.${media.extension}`;
  }

  return "attachment";
};

const getDocumentLabel = (media: MessageMedia): string => {
  const extension = media.extension?.toLowerCase();
  if (!extension) return "Document";

  if (extension === "pdf") return "PDF";
  if (["doc", "docx"].includes(extension)) return "Word Document";
  if (["xls", "xlsx", "csv"].includes(extension)) return "Spreadsheet";
  if (["ppt", "pptx"].includes(extension)) return "Presentation";
  if (["txt", "json"].includes(extension)) return "Text File";
  if (["zip", "rar", "7z"].includes(extension)) return "Archive";
  return "Document";
};

const getMediaLabel = (media: MessageMedia): string => {
  switch (media.type) {
    case "image":
      return "Image";
    case "video":
      return "Video";
    case "audio":
      return "Audio";
    case "document":
      return getDocumentLabel(media);
    default:
      return "File";
  }
};

const getMediaIcon = (media: MessageMedia) => {
  if (media.type === "image") {
    return <FileImage className="h-5 w-5" />;
  }
  if (media.type === "video") {
    return <FileVideo className="h-5 w-5" />;
  }
  if (media.type === "audio") {
    return <FileAudio className="h-5 w-5" />;
  }

  if (media.type === "document") {
    const extension = media.extension?.toLowerCase();
    if (extension === "pdf") {
      return <FileText className="h-5 w-5" />;
    }
    if (["xls", "xlsx", "csv"].includes(extension ?? "")) {
      return <FileSpreadsheet className="h-5 w-5" />;
    }
    if (["zip", "rar", "7z"].includes(extension ?? "")) {
      return <FileArchive className="h-5 w-5" />;
    }
    return <FileText className="h-5 w-5" />;
  }

  return <File className="h-5 w-5" />;
};

export function MessageBubble({
  message,
  canDelete,
  onDelete,
  isDeleting,
  onReply,
  onScrollToMessage,
}: MessageBubbleProps) {
  const isOutgoing = message.direction === "outbound";

  const media = (message.media as MessageMedia | null) ?? null;

  const formatTime = (date: string | Date) => {
    try {
      return format(new Date(date), "h:mm a");
    } catch {
      return "";
    }
  };

  const getStatusIcon = () => {
    if (!isOutgoing) return null;
    
    if (message.status === "sent" || message.status === "delivered") {
      return <CheckCheck className="h-4 w-4" />;
    }
    return <Check className="h-4 w-4" />;
  };

  const cardBaseClass = "flex items-center gap-3 rounded-md border px-3 py-2 text-sm transition";
  const cardToneClass = isOutgoing
    ? "border-primary-foreground/30 bg-primary-foreground/10 hover:bg-primary-foreground/20"
    : "border-border bg-muted/60 hover:bg-muted";
  const failureCardTone = isOutgoing
    ? "border-primary-foreground/40 bg-primary-foreground/10"
    : "border-destructive/30 bg-destructive/10";
  const detailTextClass = isOutgoing ? "text-primary-foreground/80" : "text-muted-foreground";

  const renderDownloadCard = (media: MessageMedia) => (
    <a
      href={media.url ?? undefined}
      target="_blank"
      rel="noopener noreferrer"
      className={`${cardBaseClass} ${cardToneClass}`}
      aria-label={`Download ${getMediaDisplayName(media)}`}
      data-testid="message-attachment-card"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
        {getMediaIcon(media)}
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="truncate font-medium">{getMediaDisplayName(media)}</div>
        <div className={`text-xs ${detailTextClass}`}>
          {getMediaLabel(media)}
          {formatFileSize(media.sizeBytes) ? ` • ${formatFileSize(media.sizeBytes)}` : ""}
        </div>
      </div>
      <Download className="h-4 w-4 flex-shrink-0" />
    </a>
  );

  const renderMedia = (media: MessageMedia | null) => {
    if (!media) {
      return null;
    }

    if (media.status === "failed") {
      return (
        <div className={`mb-2 rounded-md border px-3 py-2 text-sm ${failureCardTone}`}>
          <div className="font-medium">Attachment unavailable</div>
          <div className={`text-xs ${detailTextClass}`}>
            {media.downloadError ?? "Preview failed to generate."}
          </div>
        </div>
      );
    }

    if (media.status === "pending" || media.status === "processing") {
      if (media.type === "image" || media.type === "document") {
        return (
          <div className="mb-2 space-y-2">
            <Skeleton className="h-40 w-full max-w-[280px] rounded-md" />
            <div className={`flex items-center gap-2 text-xs ${detailTextClass}`}>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Preparing preview…</span>
            </div>
          </div>
        );
      }

      return (
        <div className={`mb-2 ${cardBaseClass} ${cardToneClass}`}>
          <Loader2 className="h-5 w-5 animate-spin" />
          <div className="flex-1">
            <div className="font-medium">Preparing attachment…</div>
            <div className={`text-xs ${detailTextClass}`}>This will be ready shortly.</div>
          </div>
        </div>
      );
    }

    if (!media.url) {
      return (
        <div className={`mb-2 ${cardBaseClass} ${cardToneClass}`}>
          <File className="h-5 w-5" />
          <div className="flex-1">
            <div className="font-medium">Attachment ready</div>
            <div className={`text-xs ${detailTextClass}`}>Download link unavailable.</div>
          </div>
        </div>
      );
    }

    if (media.type === "image") {
      const previewUrl = media.thumbnailUrl ?? media.previewUrl ?? media.url;
      return (
        <a
          href={media.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-2 block overflow-hidden rounded-md border border-border/40 bg-muted/20"
          aria-label={`Open image ${getMediaDisplayName(media)}`}
        >
          <img
            src={previewUrl}
            alt={getMediaDisplayName(media)}
            loading="lazy"
            decoding="async"
            className="h-auto w-full max-w-[320px] object-cover"
          />
        </a>
      );
    }

    if (media.type === "document") {
      const previewUrl = media.previewUrl ?? media.thumbnailUrl ?? null;
      return (
        <div className="mb-2 space-y-2">
          {previewUrl && (
            <a
              href={media.url}
              target="_blank"
              rel="noopener noreferrer"
              className="relative block overflow-hidden rounded-md border border-border/40 bg-muted/30"
              aria-label={`Open ${getMediaDisplayName(media)}`}
            >
              <img
                src={previewUrl}
                alt={getMediaDisplayName(media)}
                loading="lazy"
                decoding="async"
                className="h-auto w-full max-w-[320px] object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-3 text-xs text-white">
                <div className="truncate text-sm font-medium">{getMediaDisplayName(media)}</div>
                <div className="opacity-80">
                  {getMediaLabel(media)}
                  {formatFileSize(media.sizeBytes) ? ` • ${formatFileSize(media.sizeBytes)}` : ""}
                </div>
              </div>
            </a>
          )}
          {renderDownloadCard(media)}
        </div>
      );
    }

    return (
      <div className="mb-2">
        {renderDownloadCard(media)}
      </div>
    );
  };

  const mediaContent = renderMedia(media);

  return (
    <div
      id={`message-${message.id}`}
      className={`group relative flex ${isOutgoing ? "justify-end" : "justify-start"}`}
    >
      {canDelete && onDelete && (
        <div
          className={`absolute top-1 ${
            isOutgoing ? "left-[-40px]" : "right-[-40px]"
          } flex items-center justify-center`}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full text-muted-foreground opacity-70 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100"
                aria-label="Message actions"
                data-testid={`message-${message.id}-actions`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={isOutgoing ? "start" : "end"} sideOffset={4}>
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  onDelete();
                }}
                disabled={isDeleting}
                className="text-destructive focus:text-destructive"
                data-testid={`message-${message.id}-delete`}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {isDeleting ? "Deleting..." : "Delete message"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <div
        className={`max-w-[75%] rounded-lg px-3 py-2 ${
          isOutgoing
            ? "bg-primary text-primary-foreground"
            : "bg-card text-card-foreground shadow-sm"
        }`}
        style={{
          borderRadius: isOutgoing
            ? "8px 8px 2px 8px"
            : "8px 8px 8px 2px",
        }}
        data-testid={`message-${message.id}`}
      >
        {message.replyTo && (
          <button
            type="button"
            onClick={() => {
              if (message.replyTo?.id) {
                onScrollToMessage?.(message.replyTo.id);
              }
            }}
            className={`mb-2 w-full rounded-md border px-2 py-1 text-left text-xs transition ${
              isOutgoing
                ? "border-primary-foreground/40 bg-primary-foreground/10 hover:bg-primary-foreground/20"
                : "border-border bg-muted/60 hover:bg-muted"
            }`}
            aria-label={`View replied message: ${getSnippet(message.replyTo?.content ?? "")}`}
          >
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Replying to{" "}
              {message.replyTo?.senderLabel ?? getReplyLabel(message.replyTo?.direction ?? "inbound")}
            </div>
            <div className="line-clamp-1 text-xs text-foreground/80">
              {getSnippet(message.replyTo?.content ?? null)}
            </div>
          </button>
        )}

        {mediaContent}

        {message.body?.trim() && (
          <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
            {message.body}
          </p>
        )}

        <div className={`flex items-center justify-end gap-1 mt-1 text-xs ${
          isOutgoing ? "text-primary-foreground/70" : "text-muted-foreground"
        }`}>
          <span>{formatTime(message.createdAt!)}</span>
          {getStatusIcon()}
        </div>
      </div>

      {!isOutgoing && onReply && (
        <div className="absolute -bottom-6 left-0 opacity-0 transition group-hover:opacity-100">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={() => onReply(message)}
            aria-label="Reply to this message"
          >
            Reply
          </Button>
        </div>
      )}
    </div>
  );
}
