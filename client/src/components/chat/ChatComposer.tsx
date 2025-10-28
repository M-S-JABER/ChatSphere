import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Attachment, AttachmentBar, type AttachmentUploadState } from "./AttachmentBar";
import {
  DEFAULT_ACCEPTED_TYPES,
  validateFiles,
  readDroppedText,
  isImage,
} from "@/lib/attachmentUtils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import { Smile, Paperclip, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ComposerAttachment = Attachment;
type UpdateAttachmentUploadState = (id: string, state: Partial<AttachmentUploadState>) => void;

export type ChatComposerSendPayload = {
  text: string;
  attachments: ComposerAttachment[];
  replyToMessageId?: string;
  setAttachmentUploadState: UpdateAttachmentUploadState;
};

type ReplyContext = {
  id: string;
  senderLabel: string;
  snippet: string;
};

export type ChatComposerProps = {
  onSend: (payload: ChatComposerSendPayload) => Promise<void> | void;
  maxFiles?: number;
  maxFileSizeMB?: number;
  acceptedTypes?: ReadonlyArray<string>;
  disabled?: boolean;
  className?: string;
  replyTo?: ReplyContext | null;
  onClearReply?: () => void;
};

export interface ChatComposerHandle {
  attachments: ComposerAttachment[];
  addAttachments: (files: File[]) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;
  insertText: (text: string) => void;
  setAttachmentUploadState: UpdateAttachmentUploadState;
}

const DEFAULT_MAX_FILES = 10;
const DEFAULT_MAX_FILE_SIZE_MB = 100;

const createAttachment = (file: File): ComposerAttachment => {
  const mime = file.type || "application/octet-stream";
  const kind: ComposerAttachment["kind"] = isImage(mime) ? "image" : "file";
  const previewUrl = kind === "image" ? URL.createObjectURL(file) : undefined;
  return {
    id: crypto.randomUUID(),
    file,
    kind,
    name: file.name || "Untitled",
    mime,
    size: file.size,
    previewUrl,
    uploadState: {
      status: "pending",
      progress: 0,
    },
  };
};

const revokeAttachmentUrl = (attachment: ComposerAttachment) => {
  if (attachment.previewUrl) {
    URL.revokeObjectURL(attachment.previewUrl);
  }
};

export const ChatComposer = forwardRef<ChatComposerHandle, ChatComposerProps>(
  function ChatComposer(
    {
      onSend,
      maxFiles = DEFAULT_MAX_FILES,
      maxFileSizeMB = DEFAULT_MAX_FILE_SIZE_MB,
      acceptedTypes = DEFAULT_ACCEPTED_TYPES,
      disabled,
      className,
      replyTo,
      onClearReply,
    },
    ref,
  ) {
    const [message, setMessage] = useState("");
    const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
    const [errors, setErrors] = useState<string[]>([]);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const selectionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
    const attachmentsRef = useRef<ComposerAttachment[]>(attachments);
    const clearTimerRef = useRef<number | null>(null);

    const updateSelection = useCallback(() => {
      const el = textareaRef.current;
      if (!el) return;
      selectionRef.current = {
        start: el.selectionStart ?? el.value.length,
        end: el.selectionEnd ?? el.value.length,
      };
    }, []);

    const insertTextAtCursor = useCallback((text: string) => {
      if (!text) return;
      const { start, end } = selectionRef.current;
      setMessage((prev) => {
        const before = prev.slice(0, start);
        const after = prev.slice(end);
        const next = `${before}${text}${after}`;

        requestAnimationFrame(() => {
          const el = textareaRef.current;
          if (!el) return;
          const cursor = before.length + text.length;
          el.focus();
          el.setSelectionRange(cursor, cursor);
          selectionRef.current = { start: cursor, end: cursor };
        });

        return next;
      });
    }, []);

    const appendErrors = useCallback((rejections: Array<{ file: File; reason: string }>) => {
      if (rejections.length === 0) return;
      setErrors((prev) => {
        const messages = rejections.map((item) => `${item.file.name}: ${item.reason}`);
        const next = [...prev, ...messages];
        return Array.from(new Set(next));
      });
    }, []);

    const addAttachments = useCallback(
      (files: File[]) => {
        if (!files || files.length === 0) return;

        const { accepted, rejected } = validateFiles(files, {
          maxFiles,
          maxFileSizeMB,
          acceptedTypes,
          currentCount: attachments.length,
        });

        appendErrors(rejected);

        if (accepted.length === 0) {
          return;
        }

        setAttachments((prev) => [...prev, ...accepted.map(createAttachment)]);
      },
      [acceptedTypes, appendErrors, attachments.length, maxFileSizeMB, maxFiles],
    );

    const removeAttachment = useCallback((id: string) => {
      setAttachments((prev) => {
        const next = prev.filter((item) => {
          if (item.id === id) {
            revokeAttachmentUrl(item);
            return false;
          }
          return true;
        });
        return next;
      });
    }, []);

    const clearAttachments = useCallback(() => {
      if (clearTimerRef.current !== null) {
        window.clearTimeout(clearTimerRef.current);
        clearTimerRef.current = null;
      }

      setAttachments((prev) => {
        prev.forEach(revokeAttachmentUrl);
        return [];
      });
    }, []);

    const setAttachmentUploadState = useCallback<UpdateAttachmentUploadState>((id, state) => {
      setAttachments((prev) =>
        prev.map((item) => {
          if (item.id !== id) {
            return item;
          }

          const previousState = item.uploadState ?? { status: "pending", progress: 0 };
          const nextStatus = state.status ?? previousState.status;
          let nextProgress =
            state.progress !== undefined ? Math.max(0, Math.min(100, state.progress)) : previousState.progress;

          if (nextStatus === "success" && state.progress === undefined) {
            nextProgress = 100;
          }

          const nextError =
            state.error ??
            (nextStatus === "error" ? previousState.error ?? "Upload failed." : undefined);

          return {
            ...item,
            uploadState: {
              status: nextStatus,
              progress: nextProgress,
              error: nextError,
            },
          };
        }),
      );
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        attachments,
        addAttachments,
        removeAttachment,
        clearAttachments,
        insertText: insertTextAtCursor,
        setAttachmentUploadState,
      }),
      [attachments, addAttachments, clearAttachments, insertTextAtCursor, removeAttachment, setAttachmentUploadState],
    );

    useEffect(() => {
      attachmentsRef.current = attachments;
    }, [attachments]);

    useEffect(() => {
      return () => {
        attachmentsRef.current.forEach(revokeAttachmentUrl);
        if (clearTimerRef.current !== null) {
          window.clearTimeout(clearTimerRef.current);
        }
      };
    }, []);

    // إبقاء الـ textarea بالحجم المناسب عند تغيّر النص (تعزيز للأوتو-ريسايز في onChange)
    useEffect(() => {
      const el = textareaRef.current;
      if (el) {
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
      }
    }, [message]);

    const handleEmojiClick = (emojiData: EmojiClickData) => {
      insertTextAtCursor(emojiData.emoji);
      setShowEmojiPicker(false);
    };

    const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      addAttachments(files);
      event.target.value = "";
    };

    const handlePaste = async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (disabled) return;
      const clipboard = event.clipboardData;
      if (!clipboard) return;

      const files = Array.from(clipboard.files ?? []);
      const text = clipboard.getData("text");

      if (files.length > 0) {
        event.preventDefault();
        addAttachments(files);
        if (text) {
          insertTextAtCursor(text);
        }
        return;
      }
      requestAnimationFrame(updateSelection);
    };

    const handleDrop = async (event: React.DragEvent<HTMLTextAreaElement | HTMLDivElement>) => {
      if (disabled) return;
      event.preventDefault();
      event.stopPropagation();

      const dataTransfer = event.dataTransfer;
      const files = Array.from(dataTransfer?.files ?? []);
      if (files.length > 0) {
        addAttachments(files);
      }
      const text = await readDroppedText(dataTransfer);
      if (text) {
        insertTextAtCursor(text);
      }
    };

    const handleSend = async () => {
      const trimmed = message.trim();
      if ((trimmed.length === 0 && attachments.length === 0) || disabled || isSending) {
        return;
      }

      setErrors([]);
      setIsSending(true);
      try {
        await onSend({
          text: trimmed,
          attachments,
          replyToMessageId: replyTo?.id,
          setAttachmentUploadState,
        });
        setMessage("");
        onClearReply?.();

        const snapshot = attachmentsRef.current;
        const shouldClear =
          snapshot.length === 0 ||
          snapshot.every((item) => item.uploadState?.status === "success");

        if (shouldClear) {
          const delay = snapshot.length > 0 ? 600 : 0;
          if (clearTimerRef.current !== null) {
            window.clearTimeout(clearTimerRef.current);
          }
          clearTimerRef.current = window.setTimeout(() => {
            clearAttachments();
            clearTimerRef.current = null;
          }, delay);
        }
      } finally {
        setIsSending(false);
      }
    };

    const isSendDisabled =
      disabled ||
      isSending ||
      (message.trim().length === 0 && attachments.length === 0);

    return (
      <div
        className={cn(
          // ✅ الحاوية الخارجية للـ composer تبقى أسفل إطار المحادثة نفسه
          "sticky bottom-0 inset-x-0 z-10",
          // خلفية شبه زجاجية وحد علوي وظل خفيف ليفصلها بصرياً
          "bg-background/95 backdrop-blur-md border-t border-border/60 shadow-[0_-6px_16px_rgba(0,0,0,0.08)]",
          // مسافات مريحة + دعم السيف-إريا على الموبايل
          "px-3 py-2 md:px-6",
          className
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        onDrop={handleDrop}
        onDragOver={(event) => {
          if (disabled) return;
          event.preventDefault();
        }}
      >
        {replyTo && (
          <div
            className="mb-2 flex items-start justify-between rounded-lg border border-primary/40 bg-primary/10 px-3 py-2"
            aria-live="polite"
          >
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Replying to {replyTo.senderLabel}
              </p>
              <p className="text-sm text-foreground/90 line-clamp-2">
                {replyTo.snippet}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="ml-2 text-primary"
              onClick={onClearReply}
              aria-label={`Clear reply to: ${replyTo.snippet}`}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        <AttachmentBar attachments={attachments} onRemove={removeAttachment} />

        {errors.length > 0 && (
          <div className="mt-1 text-sm text-destructive" role="status" aria-live="polite">
            {errors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        )}

        {/* ✅ كتلة الـ composer نفسها */}
        <div className="mt-2 flex items-end gap-2 rounded-2xl border border-border/60 bg-card/95 px-2 py-2 shadow-sm">
          <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
            <PopoverTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                type="button"
                className="h-9 w-9 rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                disabled={disabled}
                aria-label="Insert emoji"
              >
                <Smile className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
            {/* ✅ رفع الـ z-index للـ popover عشان ما يختفي وراء الـ composer */}
            <PopoverContent side="top" align="start" className="z-50 w-auto border-none p-0 shadow-lg">
              <EmojiPicker
                onEmojiClick={handleEmojiClick}
                searchDisabled={false}
                skinTonesDisabled
                width={320}
                height={380}
                lazyLoadEmojis
              />
            </PopoverContent>
          </Popover>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileInputChange}
            accept={acceptedTypes.join(",")}
          />

          <Button
            size="icon"
            variant="ghost"
            type="button"
            className="h-9 w-9 rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || attachments.length >= maxFiles}
            aria-label="Attach files"
          >
            <Paperclip className="h-5 w-5" />
          </Button>

          <div className="relative flex flex-1 items-center px-1">
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={(event) => {
                setMessage(event.target.value);
                requestAnimationFrame(updateSelection);
                // ✅ أوتو-ريسايز نظيف
                const textarea = event.target;
                textarea.style.height = "auto";
                const next = Math.min(textarea.scrollHeight, 160);
                textarea.style.height = `${next}px`;
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
              onSelect={updateSelection}
              onKeyUp={updateSelection}
              onClick={updateSelection}
              onPaste={handlePaste}
              onDrop={handleDrop}
              placeholder="Type a message"
              disabled={disabled}
              rows={1}
              // ✅ أصلحنا حجم النص (كان text-[5px]) وخلّيناه مقروء
              className="w-full resize-none border-none bg-transparent text-sm leading-6 placeholder:text-muted-foreground focus-visible:ring-0"
              style={{
                minHeight: "44px",
                maxHeight: "160px",
                overflow: "hidden",
              }}
            />
          </div>

          <Button
            size="icon"
            variant="default"
            type="button"
            onClick={handleSend}
            disabled={isSendDisabled}
            className={cn(
              "h-10 w-10 rounded-full shadow-sm transition-all active:scale-95",
              isSendDisabled && "pointer-events-none opacity-60",
            )}
            aria-label="Send message"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>

        {attachments.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground" aria-live="polite">
            {attachments.length} attachment{attachments.length === 1 ? "" : "s"} ready to send.
          </p>
        )}
      </div>
    );
  },
);

ChatComposer.displayName = "ChatComposer";
