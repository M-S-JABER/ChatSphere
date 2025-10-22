import { type Message } from "@shared/schema";
import { format } from "date-fns";
import {
  Check,
  CheckCheck,
  Download,
  FileText,
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

interface MessageBubbleProps {
  message: Message;
  canDelete?: boolean;
  onDelete?: () => void;
  isDeleting?: boolean;
}

export function MessageBubble({ message, canDelete, onDelete, isDeleting }: MessageBubbleProps) {
  const isOutgoing = message.direction === "out";

  const mediaUrl = message.media?.url ?? undefined;
  const mediaFilename = message.media?.filename || (mediaUrl ? mediaUrl.split("/").pop()?.split("?")[0] : undefined);

  const extension = mediaUrl
    ? mediaUrl.split("?")[0].split("#")[0].split(".").pop()?.toLowerCase() || ""
    : "";

  const isImage = extension
    ? ["jpg", "jpeg", "png", "gif", "webp"].includes(extension)
    : false;

  const isDocument = extension ? ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv"].includes(extension) : false;

  const isVideo = extension ? ["mp4", "mov", "avi", "mkv", "webm"].includes(extension) : false;

  const isAudio = extension ? ["mp3", "mpeg", "ogg", "wav", "aac"].includes(extension) : false;

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

  return (
    <div className={`group relative flex ${isOutgoing ? "justify-end" : "justify-start"}`}>
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
        {mediaUrl && (
          <div className="mb-2">
            {isImage ? (
              <img
                src={mediaUrl}
                alt={mediaFilename || "Message attachment"}
                className="rounded-md max-w-[320px] w-full h-auto"
                data-testid="message-image"
              />
            ) : (
              <a
                href={mediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm transition hover:brightness-95 ${
                  isOutgoing ? "border-primary-foreground/30" : "border-border"
                }`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="truncate font-medium">
                    {mediaFilename || "Attachment"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {isDocument ? "Document" : isVideo ? "Video" : isAudio ? "Audio" : "File"}
                  </div>
                </div>
                <Download className="h-4 w-4" />
              </a>
            )}
          </div>
        )}
        
        {message.body && (
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
    </div>
  );
}
