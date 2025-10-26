import type { ChatMessage } from "@/types/messages";
import type { MessageMedia } from "@shared/schema";
import { format } from "date-fns";
import {
  AlertTriangle,
  Check,
  CheckCheck,
  Clock,
  Download,
  File,
  FileArchive,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Loader2,
  MoreHorizontal,
  Reply,
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
import { cn } from "@/lib/utils";
import { Fragment } from "react";

type MessageBubbleProps = {
  message: ChatMessage;
  canDelete?: boolean;
  onDelete?: () => void;
  isDeleting?: boolean;
  onReply?: (message: ChatMessage) => void;
  onScrollToMessage?: (messageId: string) => void;
  searchTerm?: string;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  isHighlighted?: boolean;
};

const replyLabel = (direction: string | null | undefined) =>
  direction === "outbound" ? "You" : "Customer";

const formatFileSize = (bytes?: number | null): string => {
  if (!bytes || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size < 10 && unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
};

const highlight = (text: string, term: string | undefined) => {
  if (!term?.trim()) {
    return text;
  }
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "ig");
  const segments = text.split(regex);
  const lowerTerm = term.toLowerCase();

  return segments.map((segment, index) => {
    const isMatch = segment.toLowerCase() === lowerTerm;
    return isMatch ? (
      <mark
        key={`${segment}-${index}`}
        className="rounded-sm bg-primary/20 px-0.5 text-foreground"
      >
        {segment}
      </mark>
    ) : (
      <Fragment key={`${segment}-${index}`}>{segment}</Fragment>
    );
  });
};

const getMediaIcon = (media: MessageMedia) => {
  switch (media.type) {
    case "image":
      return <FileImage className="h-5 w-5" />;
    case "video":
      return <FileVideo className="h-5 w-5" />;
    case "audio":
      return <FileAudio className="h-5 w-5" />;
    case "document": {
      const ext = media.extension?.toLowerCase();
      if (ext === "pdf") return <FileText className="h-5 w-5" />;
      if (["xls", "xlsx", "csv"].includes(ext ?? "")) return <FileSpreadsheet className="h-5 w-5" />;
      if (["zip", "rar", "7z"].includes(ext ?? "")) return <FileArchive className="h-5 w-5" />;
      return <FileText className="h-5 w-5" />;
    }
    default:
      return <File className="h-5 w-5" />;
  }
};

const getMediaLabel = (media: MessageMedia) => {
  if (media.type === "image") return "Photo";
  if (media.type === "video") return "Video";
  if (media.type === "audio") return "Audio";
  return media.extension?.toUpperCase() ?? "File";
};

const getStatusIcon = (status: string | null | undefined) => {
  switch (status) {
    case "read":
      return <CheckCheck className="h-4 w-4 text-primary-foreground" />;
    case "delivered":
      return <CheckCheck className="h-4 w-4 text-primary-foreground/80" />;
    case "sent":
      return <Check className="h-4 w-4 text-primary-foreground/80" />;
    case "queued":
      return <Clock className="h-4 w-4 text-primary-foreground/70" />;
    case "failed":
      return <AlertTriangle className="h-4 w-4 text-destructive" />;
    default:
      return <Check className="h-4 w-4 text-primary-foreground/70" />;
  }
};

const messageTime = (createdAt: string | Date | null | undefined) => {
  if (!createdAt) return "";
  try {
    return format(new Date(createdAt), "p");
  } catch {
    return "";
  }
};

const getMediaDisplayName = (media: MessageMedia) => {
  if (media.filename?.trim()) return media.filename.trim();
  if (media.extension) return `attachment.${media.extension}`;
  return "attachment";
};

export function MessageBubble({
  message,
  canDelete,
  onDelete,
  isDeleting,
  onReply,
  onScrollToMessage,
  searchTerm,
  isFirstInGroup = true,
  isLastInGroup = true,
  isHighlighted = false,
}: MessageBubbleProps) {
  const isOutbound = message.direction === "outbound";
  const media = (message.media as MessageMedia | null) ?? null;

  const bodyContent = message.body?.trim() ?? "";

  const bubbleClasses = cn(
    "w-fit max-w-[92%] rounded-3xl px-4 py-2 shadow-sm transition md:max-w-[72%] xl:max-w-[60%]",
    isOutbound
      ? "ms-auto bg-[#005c4b] text-primary-foreground"
      : "bg-muted/70 text-foreground",
    isFirstInGroup && (isOutbound ? "rounded-tr-sm" : "rounded-tl-sm"),
    isLastInGroup ? "rounded-b-3xl" : isOutbound ? "rounded-br-sm" : "rounded-bl-sm",
    isHighlighted && "ring-2 ring-primary/50 ring-offset-2 ring-offset-background",
  );

  const containerClasses = cn(
    "flex w-full flex-col gap-2 px-3 text-sm md:px-6",
    isOutbound ? "items-end" : "items-start",
    isFirstInGroup ? "mt-3" : "mt-1.5",
  );

  const renderMediaBlock = () => {
    if (!media) return null;

    if (media.status === "failed") {
      return (
        <div className="flex items-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <span>{media.downloadError ?? "Attachment could not be loaded."}</span>
        </div>
      );
    }

    if (media.status === "pending" || media.status === "processing") {
      return (
        <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Preparing attachment…</span>
        </div>
      );
    }

    if (!media.url) {
      return (
        <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
          <File className="h-4 w-4" />
          <span>Attachment ready. Link unavailable.</span>
        </div>
      );
    }

    if (media.type === "image") {
      const preview = media.thumbnailUrl ?? media.previewUrl ?? media.url;
      return (
        <a
          href={media.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block max-w-[92%] overflow-hidden rounded-2xl border border-border/60 bg-black/5 md:max-w-[72%] xl:max-w-[60%]"
        >
          <img
            src={preview ?? media.url}
            alt={getMediaDisplayName(media)}
            loading="lazy"
            decoding="async"
            className="h-auto w-full max-h-[360px] object-cover"
          />
        </a>
      );
    }

    return (
      <a
        href={media.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-full max-w-[92%] items-center gap-3 rounded-2xl border border-border/60 bg-background/80 px-3 py-2 text-left transition hover:bg-background md:max-w-[72%] xl:max-w-[60%]"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {getMediaIcon(media)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{getMediaDisplayName(media)}</p>
          <p className="truncate text-xs text-muted-foreground">
            {getMediaLabel(media)}
            {media.sizeBytes ? ` • ${formatFileSize(media.sizeBytes)}` : ""}
          </p>
        </div>
        <Download className="h-4 w-4 text-muted-foreground" />
      </a>
    );
  };

  const statusIcon = isOutbound ? getStatusIcon(message.status) : null;

  return (
    <div className={containerClasses} id={`message-${message.id}`} data-testid={`message-${message.id}`}>
      <div className="flex w-full items-center gap-2">
        {!isOutbound && isFirstInGroup && (
          <span className="sr-only">Message from contact</span>
        )}
        <div className={bubbleClasses}>
          {message.replyTo && (
            <button
              type="button"
              onClick={() => message.replyTo?.id && onScrollToMessage?.(message.replyTo.id)}
              className={cn(
                "mb-2 w-full rounded-2xl px-3 py-2 text-left text-xs transition",
                isOutbound
                  ? "bg-white/10 text-primary-foreground/80 hover:bg-white/15"
                  : "bg-white/40 text-muted-foreground hover:bg-white/65",
              )}
              aria-label={`View replied message ${message.replyTo?.id ?? ""}`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider">
                Replying to {replyLabel(message.replyTo?.direction)}
              </p>
              <p className="line-clamp-2 text-xs">
                {message.replyTo?.content?.trim() ?? "Original message unavailable"}
              </p>
            </button>
          )}

          {renderMediaBlock()}

          {bodyContent && (
            <p className="whitespace-pre-wrap text-[15px] leading-6">
              {highlight(bodyContent, searchTerm)}
            </p>
          )}

          <div
            className={cn(
              "mt-1 flex items-center gap-1 text-[11px]",
              isOutbound ? "justify-end text-primary-foreground/80" : "justify-end text-muted-foreground",
            )}
          >
            <span>{messageTime(message.createdAt)}</span>
            {statusIcon}
          </div>
        </div>
      </div>

      {!isOutbound && onReply && (
        <div className="-mb-1 flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 rounded-full px-3 text-xs text-muted-foreground transition hover:text-primary"
            onClick={() => onReply(message)}
          >
            <Reply className="mr-1 h-3.5 w-3.5" />
            Reply
          </Button>
        </div>
      )}

      {canDelete && onDelete && (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full text-muted-foreground transition hover:text-destructive"
                aria-label="Message actions"
                data-testid={`message-${message.id}-actions`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  onDelete();
                }}
                disabled={isDeleting}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {isDeleting ? "Deleting…" : "Delete message"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
