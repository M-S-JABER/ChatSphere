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

export type ChatComposerProps = {
  onSend: (payload: {
    text: string;
    attachments: ComposerAttachment[];
    replyToMessageId?: string;
    setAttachmentUploadState: UpdateAttachmentUploadState;
  }) => Promise<void> | void;
  maxFiles?: number;
  maxFileSizeMB?: number;
  acceptedTypes?: ReadonlyArray<string>;
  disabled?: boolean;
  className?: string;
  replyTo?: {
    id: string;
    senderLabel: string;
    snippet: string;
  } | null;
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

export const ChatComposer = forwardRef<ChatComposerHandle, ChatComposerProps>(
  function ChatComposer({
    onSend,
    maxFiles = 10,
    maxFileSizeMB = 100,
    acceptedTypes = DEFAULT_ACCEPTED_TYPES,
    disabled,
    className,
    replyTo,
    onClearReply,
  }, ref) {
    const [message, setMessage] = useState("");
    const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
    const [errors, setErrors] = useState<string[]>([]);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Handle text area auto-resize
    useEffect(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const updateHeight = () => {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px';
      };

      textarea.addEventListener('input', updateHeight);
      updateHeight();

      return () => textarea.removeEventListener('input', updateHeight);
    }, [message]);

    const handleEmojiSelect = useCallback((emojiData: EmojiClickData) => {
      setMessage(prev => prev + emojiData.emoji);
      setShowEmojiPicker(false);
    }, []);

    const handleAttach = useCallback(() => {
      fileInputRef.current?.click();
    }, []);

    const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      if (!files.length) return;

      const newAttachments: Attachment[] = files.map(file => ({
        id: crypto.randomUUID(),
        file,
        name: file.name,
        kind: isImage(file.type) ? "image" : "file",
        mime: file.type,
        size: file.size,
        previewUrl: isImage(file.type) ? URL.createObjectURL(file) : undefined,
      }));

      setAttachments(prev => [...prev, ...newAttachments]);
      event.target.value = '';
    }, []);

    const handleSend = useCallback(async () => {
      if (disabled || isSending || (!message.trim() && !attachments.length)) return;

      setIsSending(true);
      try {
        await onSend({
          text: message.trim(),
          attachments,
          replyToMessageId: replyTo?.id,
          setAttachmentUploadState: (id, state) => {
            setAttachments(prev => prev.map(att => {
              if (att.id !== id) return att;
              const currentState = att.uploadState ?? { status: "pending", progress: 0 };
              return {
                ...att,
                uploadState: {
                  ...currentState,
                  ...state,
                  status: state.status ?? currentState.status,
                },
              } as Attachment;
            }));
          }
        });
        setMessage("");
        setAttachments([]);
        onClearReply?.();
      } finally {
        setIsSending(false);
      }
    }, [message, attachments, disabled, isSending, onSend, replyTo?.id, onClearReply]);

    useImperativeHandle(ref, () => ({
      attachments,
      addAttachments: (files) => {
        const newAttachments: Attachment[] = files.map(file => ({
          id: crypto.randomUUID(),
          file,
          name: file.name,
          kind: isImage(file.type) ? "image" : "file", 
          mime: file.type,
          size: file.size,
          previewUrl: isImage(file.type) ? URL.createObjectURL(file) : undefined,
        }));
        setAttachments(prev => [...prev, ...newAttachments]);
      },
      removeAttachment: (id) => setAttachments(prev => prev.filter(a => a.id !== id)),
      clearAttachments: () => setAttachments([]),
      insertText: (text) => setMessage(prev => prev + text),
      setAttachmentUploadState: (id, state) => {
        setAttachments(prev => prev.map(att => {
          if (att.id !== id) return att;
          const currentState = att.uploadState ?? { status: "pending", progress: 0 };
          return {
            ...att,
            uploadState: {
              ...currentState,
              ...state,
              status: state.status ?? currentState.status,
            },
          } as Attachment;
        }));
      }
    }), [attachments]);

    return (
      <div
        className={cn(
          "flex flex-col gap-2 px-4 py-2 md:px-6",
          "w-full",
          className
        )}
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* WhatsApp Web style: single input bar, safe-area padding, no overlap */}
        {replyTo && (
          <div className="flex items-start justify-between gap-2 rounded-md bg-primary/10 p-2 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-primary">
                Replying to {replyTo.senderLabel}
              </p>
              <p className="line-clamp-1 text-muted-foreground">
                {replyTo.snippet}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={onClearReply}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {attachments.length > 0 && (
          <AttachmentBar
            attachments={attachments}
            onRemove={(id) => setAttachments(prev => prev.filter(a => a.id !== id))}
          />
        )}

        <div className="flex items-end gap-1 rounded-2xl bg-card/95 py-1 pl-2 pr-1 w-full">
          <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-full text-muted-foreground transition-colors hover:text-foreground"
                disabled={disabled}
              >
                <Smile className="h-[22px] w-[22px]" />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="w-auto border-none p-0">
              <EmojiPicker
                onEmojiClick={handleEmojiSelect}
                searchDisabled={false}
                skinTonesDisabled
                width={320}
                height={400}
              />
            </PopoverContent>
          </Popover>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full text-muted-foreground transition-colors hover:text-foreground"
            onClick={handleAttach}
            disabled={disabled || attachments.length >= maxFiles}
          >
            <Paperclip className="h-[22px] w-[22px]" />
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              onChange={handleFileSelect}
              accept={acceptedTypes.join(',')}
            />
          </Button>

            <div className="relative flex flex-1 items-end px-1 w-full">
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onInput={() => {
              const ta = textareaRef.current;
              if (!ta) return;
              // auto-resize with a sensible max height
              ta.style.height = 'auto';
              const maxH = 160;
              ta.style.height = Math.min(ta.scrollHeight, maxH) + 'px';
              }}
              onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
              }}
              placeholder="Type a "
              disabled={disabled}
              rows={1}
              className="min-h-[44px] max-h-[160px] w-full resize-none border-0 bg-transparent p-2 text-base leading-normal placeholder:text-muted-foreground focus-visible:ring-0"
              style={{
              overflow: message.split('\n').length > 1 ? 'auto' : 'hidden',
              // ensure the textarea starts at auto height so onInput resizing works predictably
              height: 'auto',
              }}
            />
            </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleSend}
            disabled={disabled || isSending || (!message.trim() && !attachments.length)}
            className={cn(
              "h-10 w-10 shrink-0 rounded-full bg-primary text-primary-foreground transition-all hover:bg-primary/90 active:scale-95",
              (disabled || isSending || (!message.trim() && !attachments.length)) ? "opacity-50" : ""
            )}
            aria-disabled={disabled || isSending || (!message.trim() && !attachments.length) ? "true" : undefined}
            tabIndex={disabled || isSending || (!message.trim() && !attachments.length) ? -1 : 0}
            style={{ pointerEvents: (disabled || isSending || (!message.trim() && !attachments.length)) ? "auto" : "auto" }}
          >
            <Send className="h-[22px] w-[22px]" />
          </Button>
        </div>
      </div>
    );
  }
);