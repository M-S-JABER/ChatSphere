import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Attachment, AttachmentBar } from "./AttachmentBar";
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
import { Smile, Paperclip, Send } from "lucide-react";
import { cn } from "@/lib/utils";

type ComposerAttachment = Attachment;

export type ChatComposerProps = {
  onSend: (payload: { text: string; attachments: ComposerAttachment[] }) => Promise<void> | void;
  maxFiles?: number;
  maxFileSizeMB?: number;
  acceptedTypes?: ReadonlyArray<string>;
  disabled?: boolean;
  className?: string;
};

export interface ChatComposerHandle {
  attachments: ComposerAttachment[];
  addAttachments: (files: File[]) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;
  insertText: (text: string) => void;
}

const DEFAULT_MAX_FILES = 10;
const DEFAULT_MAX_FILE_SIZE_MB = 25;

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
  };
};

const revokeAttachmentUrl = (attachment: ComposerAttachment) => {
  if (attachment.previewUrl) {
    URL.revokeObjectURL(attachment.previewUrl);
  }
};

export const ChatComposer = forwardRef<ChatComposerHandle, ChatComposerProps>(
  ({
    onSend,
    maxFiles = DEFAULT_MAX_FILES,
    maxFileSizeMB = DEFAULT_MAX_FILE_SIZE_MB,
    acceptedTypes = DEFAULT_ACCEPTED_TYPES,
    disabled,
    className,
  },
  ref,
) => {
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const attachmentsRef = useRef<ComposerAttachment[]>(attachments);

  const updateSelection = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    selectionRef.current = {
      start: el.selectionStart ?? el.value.length,
      end: el.selectionEnd ?? el.value.length,
    };
  }, []);

  const insertTextAtCursor = useCallback(
    (text: string) => {
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
    },
    [],
  );

  const appendErrors = useCallback((rejections: Array<{ file: File; reason: string }>) => {
    if (rejections.length === 0) return;
    setErrors((prev) => {
      const messages = rejections.map((item) => `${item.file.name}: ${item.reason}`);
      const next = [...prev, ...messages];
      // Deduplicate consecutive duplicates for readability
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
    setAttachments((prev) => {
      prev.forEach(revokeAttachmentUrl);
      return [];
    });
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      attachments,
      addAttachments,
      removeAttachment,
      clearAttachments,
      insertText: insertTextAtCursor,
    }),
    [attachments, addAttachments, clearAttachments, insertTextAtCursor, removeAttachment],
  );

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach(revokeAttachmentUrl);
    };
  }, []);

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
    // default behavior handles text insertion, but ensure selection ref syncs
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
    if ((trimmed.length === 0 && attachments.length === 0) || disabled || isSubmitting) {
      return;
    }

    setErrors([]);
    setIsSubmitting(true);
    try {
      await onSend({ text: trimmed, attachments });
      setMessage("");
      clearAttachments();
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSendDisabled =
    disabled ||
    isSubmitting ||
    (message.trim().length === 0 && attachments.length === 0);

  return (
    <div
      className={cn("space-y-3 border-t border-border bg-card/60 p-3", className)}
      onDrop={handleDrop}
      onDragOver={(event) => {
        if (disabled) return;
        event.preventDefault();
      }}
    >
      <AttachmentBar attachments={attachments} onRemove={removeAttachment} />

      {errors.length > 0 && (
        <div className="text-sm text-destructive" role="status" aria-live="polite">
          {errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
          <PopoverTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              type="button"
              className="flex-shrink-0"
              disabled={disabled || isSubmitting}
              aria-label="Insert emoji"
            >
              <Smile className="h-6 w-6" />
            </Button>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="w-auto border-none p-0 shadow-lg">
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
          className="flex-shrink-0"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isSubmitting || attachments.length >= maxFiles}
          aria-label="Attach files"
        >
          <Paperclip className="h-6 w-6" />
        </Button>

        <div className="relative flex-1">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(event) => {
              setMessage(event.target.value);
              requestAnimationFrame(updateSelection);
            }}
            onSelect={updateSelection}
            onKeyUp={updateSelection}
            onClick={updateSelection}
            onPaste={handlePaste}
            onDrop={handleDrop}
            placeholder="Type a message"
            disabled={disabled || isSubmitting}
            rows={1}
            className="min-h-[48px] max-h-[160px] resize-none rounded-lg border-none bg-secondary pr-12"
          />
        </div>

        <Button
          size="icon"
          variant={isSendDisabled ? "ghost" : "default"}
          type="button"
          onClick={handleSend}
          disabled={isSendDisabled}
          className="flex-shrink-0 rounded-full"
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
      {attachments.length > 0 && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {attachments.length} attachment{attachments.length === 1 ? "" : "s"} ready to send.
        </p>
      )}
    </div>
  );
});

ChatComposer.displayName = "ChatComposer";
