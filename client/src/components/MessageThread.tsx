import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Conversation } from "@shared/schema";
import type { ChatMessage } from "@/types/messages";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChatComposer, type ChatComposerHandle, type ChatComposerSendPayload } from "./chat/ChatComposer";
import { ChatDropZone } from "./chat/ChatDropZone";
import { MessageBubble } from "./MessageBubble";
import { useToast } from "@/hooks/use-toast";
import { uploadFile } from "@/lib/uploadService";
import { cn } from "@/lib/utils";
import { useVirtualizer } from "@tanstack/react-virtual";
import { format, isSameDay } from "date-fns";
import {
  ArrowDown,
  ArrowLeft,
  Info,
  MoreVertical,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MessageThreadProps {
  conversation: Conversation | null;
  messages: ChatMessage[];
  onSendMessage: (body: string, mediaUrl?: string, replyToMessageId?: string | null) => Promise<void> | void;
  isLoading?: boolean;
  isSending?: boolean;
  canManageMessages?: boolean;
  onDeleteMessage?: (messageId: string) => Promise<unknown>;
  deletingMessageId?: string | null;
  isDeletingMessage?: boolean;
  onDeleteConversation?: () => Promise<void>;
  isDeletingConversation?: boolean;
  onBackToList?: () => void;
  showMobileHeader?: boolean;
  headerActions?: ReactNode;
  onToggleInfoDrawer?: (open: boolean) => void;
  isInfoDrawerOpen?: boolean;
}

type ReplyContext = {
  id: string;
  senderLabel: string;
  snippet: string;
};

type TimelineEntry =
  | { type: "date"; key: string; label: string; date: Date }
  | {
      type: "message";
      key: string;
      message: ChatMessage;
      isFirstInGroup: boolean;
      isLastInGroup: boolean;
    };

const GROUP_THRESHOLD_MS = 5 * 60 * 1000;

const buildSnippet = (body: string | null | undefined) => {
  if (!body) return "[Original message unavailable]";
  const trimmed = body.trim();
  if (!trimmed) return "[Original message unavailable]";
  return trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed;
};

const sortMessages = (messages: ChatMessage[]) =>
  [...messages].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return aTime - bTime;
  });

const buildTimeline = (messages: ChatMessage[]): TimelineEntry[] => {
  const sorted = sortMessages(messages);
  const entries: TimelineEntry[] = [];

  let lastDate: Date | null = null;

  sorted.forEach((message, index) => {
    const createdAt = message.createdAt ? new Date(message.createdAt) : new Date();
    const prevMessage = sorted[index - 1];
    const nextMessage = sorted[index + 1];
    const prevDate = prevMessage?.createdAt ? new Date(prevMessage.createdAt) : null;
    const nextDate = nextMessage?.createdAt ? new Date(nextMessage.createdAt) : null;
    if (!lastDate || !isSameDay(createdAt, lastDate)) {
      entries.push({
        type: "date",
        key: `date-${createdAt.toISOString().slice(0, 10)}`,
        label: format(createdAt, "EEEE, MMMM d"),
        date: createdAt,
      });
      lastDate = createdAt;
    }

    const isFirstInGroup =
      !prevMessage ||
      prevMessage.direction !== message.direction ||
      !prevDate ||
      createdAt.getTime() - prevDate.getTime() > GROUP_THRESHOLD_MS ||
      !isSameDay(createdAt, prevDate);

    const isLastInGroup =
      !nextMessage ||
      nextMessage.direction !== message.direction ||
      !nextDate ||
      nextDate.getTime() - createdAt.getTime() > GROUP_THRESHOLD_MS ||
      !isSameDay(createdAt, nextDate);

    entries.push({
      type: "message",
      key: message.id,
      message,
      isFirstInGroup,
      isLastInGroup,
    });
  });

  return entries;
};

const ScrollToBottomButton = ({
  visible,
  onClick,
  offset,
}: {
  visible: boolean;
  onClick: () => void;
  offset: number;
}) => {
  if (!visible) return null;

  const bottomOffset = Math.max(offset, 28);
  const isRtl = typeof document !== "undefined" && document.dir === "rtl";

  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute z-50 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      style={{
        bottom: `${bottomOffset}px`,
        ...(isRtl ? { left: "1.5rem" } : { right: "1.5rem" }),
      }}
      aria-label="Scroll to latest message"
    >
      <ArrowDown className="h-4 w-4" />
      New messages
    </button>
  );
};

export function MessageThread({
  conversation,
  messages,
  onSendMessage,
  isLoading,
  isSending,
  canManageMessages,
  onDeleteMessage,
  deletingMessageId,
  isDeletingMessage,
  onDeleteConversation,
  isDeletingConversation,
  onBackToList,
  showMobileHeader = false,
  headerActions,
  onToggleInfoDrawer,
  isInfoDrawerOpen,
}: MessageThreadProps) {
  const { toast } = useToast();
  const composerRef = useRef<ChatComposerHandle>(null);
  const composerContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const previousMessageCountRef = useRef(messages.length);

  const [messagePendingDeletion, setMessagePendingDeletion] = useState<ChatMessage | null>(null);
  const [deleteConversationOpen, setDeleteConversationOpen] = useState(false);
  const [replyContext, setReplyContext] = useState<ReplyContext | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isScrollPinned, setIsScrollPinned] = useState(true);
  const [composerHeight, setComposerHeight] = useState(0);

  const timelineItems = useMemo(() => buildTimeline(messages), [messages]);

  const searchMatches = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) return [];

    return timelineItems.reduce<number[]>((acc, item, index) => {
      if (item.type !== "message") return acc;
      const body = item.message.body?.toLowerCase() ?? "";
      if (body.includes(trimmed)) {
        acc.push(index);
      }
      return acc;
    }, []);
  }, [searchQuery, timelineItems]);

  const getSenderLabel = (direction: string): ReplyContext["senderLabel"] =>
    direction === "inbound" ? "Customer" : "Agent";

  const handleReplySelect = (message: ChatMessage) => {
    if (message.direction !== "inbound") return;
    setReplyContext({
      id: message.id,
      senderLabel: getSenderLabel(message.direction),
      snippet: buildSnippet(message.body ?? null),
    });
    composerRef.current?.insertText("");
  };

  const handleClearReply = () => setReplyContext(null);

  const handleDropFiles = (files: File[]) => {
    if (!files.length) return;
    composerRef.current?.addAttachments(files);
  };

  const handleDropText = (text: string) => {
    if (!text) return;
    composerRef.current?.insertText(text);
    toast({
      title: "Text added",
      description: "Dropped text has been inserted into the message box.",
    });
  };

  const handleComposerSend = async ({
    text,
    attachments: composerAttachments,
    replyToMessageId,
    setAttachmentUploadState,
  }: ChatComposerSendPayload) => {
    if (!conversation) {
      throw new Error("No conversation selected");
    }

    const trimmed = text.trim();
    const effectiveReplyId = replyToMessageId ?? replyContext?.id ?? null;

    try {
      if (trimmed) {
        await Promise.resolve(onSendMessage(trimmed, undefined, effectiveReplyId));
      }

      for (const attachment of composerAttachments) {
        setAttachmentUploadState(attachment.id, {
          status: "uploading",
          progress: 0,
          error: undefined,
        });

        try {
          const response = await uploadFile(attachment.file, {
            onProgress: (progress) => {
              setAttachmentUploadState(attachment.id, {
                status: "uploading",
                progress,
                error: undefined,
              });
            },
          });

          const mediaUrl = response.publicUrl ?? response.url;
          await Promise.resolve(onSendMessage("", mediaUrl, effectiveReplyId));
          setAttachmentUploadState(attachment.id, {
            status: "success",
            progress: 100,
            error: undefined,
          });
        } catch (error: any) {
          const message = error?.message ?? "Unable to upload attachment.";
          setAttachmentUploadState(attachment.id, {
            status: "error",
            error: message,
            progress: 0,
          });
          throw error instanceof Error ? error : new Error(message);
        }
      }

      setReplyContext(null);
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error?.message ?? "Unable to upload attachment.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const allowMessageDeletion = Boolean(canManageMessages && onDeleteMessage);

  const handleConfirmDelete = async () => {
    if (!messagePendingDeletion || !onDeleteMessage) return;

    try {
      await onDeleteMessage(messagePendingDeletion.id);
      setMessagePendingDeletion(null);
    } catch (error) {
      console.error(error);
    }
  };

  const handleScrollToMessage = (messageId: string) => {
    const element = document.getElementById(`message-${messageId}`);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    element.classList.add("ring-2", "ring-primary/70", "ring-offset-2", "ring-offset-background");
    setTimeout(() => {
      element.classList.remove("ring-2", "ring-primary/70", "ring-offset-2", "ring-offset-background");
    }, 1500);
  };

  const virtualizer = useVirtualizer({
    count: timelineItems.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: (index) => (timelineItems[index]?.type === "date" ? 40 : 120),
    overscan: 10,
  });

  const scrollToBottom = useCallback(() => {
    const scrollEl = scrollContainerRef.current;
    if (!scrollEl) return;
    scrollEl.scrollTo({
      top: scrollEl.scrollHeight,
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    const scrollEl = scrollContainerRef.current;
    if (!scrollEl) return;

    const handleScroll = () => {
      const distance = scrollEl.scrollHeight - (scrollEl.scrollTop + scrollEl.clientHeight);
      setShowScrollButton(distance > 180);
      setIsScrollPinned(distance < 220);
    };

    scrollEl.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      scrollEl.removeEventListener("scroll", handleScroll);
    };
  }, [messages, conversation?.id]);

  useEffect(() => {
    if (messages.length > previousMessageCountRef.current && isScrollPinned) {
      scrollToBottom();
    }
    previousMessageCountRef.current = messages.length;
  }, [messages.length, isScrollPinned, scrollToBottom]);

  useEffect(() => {
    if (isSearchOpen) {
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    }
  }, [isSearchOpen]);

  useEffect(() => {
    setActiveMatchIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    if (!searchMatches.length) return;
    if (activeMatchIndex >= searchMatches.length) {
      setActiveMatchIndex(Math.max(searchMatches.length - 1, 0));
      return;
    }
    const targetIndex = searchMatches[activeMatchIndex];
    if (typeof targetIndex === "number") {
      virtualizer.scrollToIndex(targetIndex, { align: "center" });
    }
  }, [activeMatchIndex, searchMatches, virtualizer]);

  useEffect(() => {
    setReplyContext(null);
    setIsSearchOpen(false);
    setSearchQuery("");
    setActiveMatchIndex(0);
    setIsScrollPinned(true);
  }, [conversation?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const element = composerContainerRef.current;
    if (!element) return;

    // Track composer height so the scroll area and FAB can account for it dynamically.
    const updateHeight = () => {
      const next = Math.round(element.getBoundingClientRect().height);
      setComposerHeight((prev) => (prev !== next ? next : prev));
    };

    updateHeight();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updateHeight);
      observer.observe(element);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  const goToNextMatch = () => {
    if (searchMatches.length === 0) return;
    setActiveMatchIndex((prev) => (prev + 1) % searchMatches.length);
  };

  const goToPreviousMatch = () => {
    if (searchMatches.length === 0) return;
    setActiveMatchIndex((prev) => (prev - 1 + searchMatches.length) % searchMatches.length);
  };

  const closeSearch = () => {
    setIsSearchOpen(false);
    setSearchQuery("");
    setActiveMatchIndex(0);
  };

  if (!conversation) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-background px-6 text-center">
        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Search className="h-12 w-12" />
        </div>
        <h2 className="text-2xl font-semibold text-foreground">WhatsApp Web</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Select a chat to start a conversation. Messages are synced across your devices instantly.
        </p>
      </div>
    );
  }

  const renderHeader = () => (
    <div className="border-b border-border/70 bg-card/95 px-4 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">{
          showMobileHeader && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="flex-shrink-0 text-muted-foreground transition hover:text-foreground"
              onClick={onBackToList}
              aria-label="Back to chats"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex h-full flex-col bg-background">
        <div className="border-b border-border/60 bg-card/90 px-5 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
            <div className="space-y-2">
              <div className="h-4 w-40 animate-pulse rounded-full bg-muted" />
              <div className="h-3 w-24 animate-pulse rounded-full bg-muted" />
            </div>
          </div>
        </div>
        <div className="flex-1 space-y-4 px-6 py-8">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className={cn(
                "flex animate-pulse gap-2",
                item % 2 === 0 ? "justify-end" : "justify-start",
              )}
            >
              <div className="h-16 w-48 rounded-3xl bg-muted" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const displayName = conversation.displayName || conversation.phone;
  const conversationStatus =
    (conversation.metadata && typeof conversation.metadata === "object" && (conversation.metadata as any)?.status) ||
    "Available";

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-background">
      <div className="flex-shrink-0 z-40 border-b border-border/70 bg-card/95 px-4 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {showMobileHeader && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="flex-shrink-0 text-muted-foreground transition hover:text-foreground"
                onClick={onBackToList}
                aria-label="Back to chats"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary">
                {(conversation.displayName ?? conversation.phone ?? "?").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
              <p className="truncate text-xs text-muted-foreground">{conversationStatus}</p>
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <Button
              variant={isSearchOpen ? "secondary" : "ghost"}
              size="icon"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => {
                setIsSearchOpen((value) => !value);
                if (isSearchOpen) {
                  closeSearch();
                }
              }}
              aria-label="Search messages"
            >
              <Search className="h-4 w-4" />
            </Button>
            {onToggleInfoDrawer && (
              <Button
                variant={isInfoDrawerOpen ? "secondary" : "ghost"}
                size="icon"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => onToggleInfoDrawer(!isInfoDrawerOpen)}
                aria-label="Conversation info"
              >
                <Info className="h-4 w-4" />
              </Button>
            )}
            {headerActions ? (
              headerActions
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Conversation menu"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onDeleteConversation && (
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={(event) => {
                        event.preventDefault();
                        setDeleteConversationOpen(true);
                      }}
                    >
                      Delete conversation
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        {isSearchOpen && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-border/70 bg-background px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search messages"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.shiftKey ? goToPreviousMatch() : goToNextMatch();
                }
                if (event.key === "Escape") {
                  closeSearch();
                }
              }}
            />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {searchMatches.length > 0 ? `${activeMatchIndex + 1} / ${searchMatches.length}` : "0 / 0"}
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-muted-foreground"
                onClick={goToPreviousMatch}
                disabled={searchMatches.length === 0}
                aria-label="Previous match"
              >
                <ArrowDown className="h-3 w-3 rotate-180" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-muted-foreground"
                onClick={goToNextMatch}
                disabled={searchMatches.length === 0}
                aria-label="Next match"
              >
                <ArrowDown className="h-3 w-3" />
              </Button>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-muted-foreground"
              onClick={closeSearch}
              aria-label="Close search"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <ChatDropZone
        onDropFiles={handleDropFiles}
        onDropText={handleDropText}
        disabled={!conversation}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto overscroll-contain scroll-smooth bg-repeat px-2 pt-6 md:px-6"
            style={{
              backgroundImage: "var(--chat-thread-wallpaper)",
              backgroundSize: "240px 240px",
              height: `calc(100dvh - ${composerHeight}px - 56px)`, // 56px for header
              // Keep the scrollable messages area padded at the bottom so the last
              // message always sits above the composer. composerHeight is tracked
              // via a ResizeObserver on the composer container.
              paddingBottom: `${composerHeight + 16}px`, // Extra padding for visual comfort
            }}
          >
            {timelineItems.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Search className="h-7 w-7" />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">No messages yet. Say hello to start chatting.</p>
              </div>
            ) : (
              <div
                style={{
                  height: virtualizer.getTotalSize(),
                  position: "relative",
                }}
              >
                {virtualizer.getVirtualItems().map((virtualItem) => {
                  const item = timelineItems[virtualItem.index];
                  const isActiveMatch =
                    searchMatches.length > 0 && searchMatches[activeMatchIndex] === virtualItem.index;

                  return (
                    <div
                      key={item.key}
                      data-index={virtualItem.index}
                      ref={virtualizer.measureElement}
                      className="absolute left-0 right-0"
                      style={{
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                    >
                      {item.type === "date" ? (
                        <div className="flex justify-center py-4">
                          <span className="rounded-full bg-card/90 px-4 py-1 text-xs font-semibold text-muted-foreground shadow-sm">
                            {item.label}
                          </span>
                        </div>
                      ) : (
                        <MessageBubble
                          message={item.message}
                          canDelete={allowMessageDeletion}
                          onDelete={
                            allowMessageDeletion ? () => setMessagePendingDeletion(item.message) : undefined
                          }
                          isDeleting={Boolean(
                            allowMessageDeletion &&
                              isDeletingMessage &&
                              deletingMessageId === item.message.id,
                          )}
                          onReply={handleReplySelect}
                          onScrollToMessage={handleScrollToMessage}
                          searchTerm={searchQuery}
                          isFirstInGroup={item.isFirstInGroup}
                          isLastInGroup={item.isLastInGroup}
                          isHighlighted={isActiveMatch}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <ScrollToBottomButton
              visible={showScrollButton}
              onClick={scrollToBottom}
              offset={composerHeight + 32}
            />
          </div>
        </div>

        <div
          ref={composerContainerRef}
          className="sticky bottom-0 z-20 w-full border-t border-border/60 bg-card/95 px-3 pb-safe pt-3 shadow-[0_-12px_24px_rgba(0,0,0,0.12)] backdrop-blur supports-[backdrop-filter]:bg-card/85 sm:px-6"
          style={{
            // Ensure the composer is visible on mobile keyboards
            position: '-webkit-sticky',
            transform: 'translate3d(0,0,0)', // Force GPU acceleration
          }}
          aria-hidden={false}
        >
          <ChatComposer
            ref={composerRef}
            onSend={handleComposerSend}
            disabled={isSending || !conversation}
            replyTo={replyContext}
            onClearReply={handleClearReply}
            className="space-y-3 border-none bg-transparent p-0"
          />
        </div>
      </ChatDropZone>

      <AlertDialog
        open={!!messagePendingDeletion}
        onOpenChange={(open) => {
          if (!open) {
            setMessagePendingDeletion(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this message?</AlertDialogTitle>
            <AlertDialogDescription>
              {messagePendingDeletion?.body
                ? `This will permanently remove the message "${
                    messagePendingDeletion.body.slice(0, 100)
                  }${messagePendingDeletion.body.length > 100 ? "..." : ""}".`
                : "This will permanently remove the selected message."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={Boolean(
                isDeletingMessage &&
                  deletingMessageId &&
                  messagePendingDeletion &&
                  deletingMessageId === messagePendingDeletion.id,
              )}
            >
              {isDeletingMessage &&
              deletingMessageId &&
              messagePendingDeletion &&
              deletingMessageId === messagePendingDeletion.id
                ? "Deleting..."
                : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {onDeleteConversation && (
        <AlertDialog open={deleteConversationOpen} onOpenChange={setDeleteConversationOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete entire conversation?</AlertDialogTitle>
              <AlertDialogDescription>
                This action removes every message in this thread. You can’t undo this.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  try {
                    await onDeleteConversation();
                    setDeleteConversationOpen(false);
                  } catch (error) {
                    console.error(error);
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={isDeletingConversation}
              >
                {isDeletingConversation ? "Deleting…" : "Delete conversation"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}