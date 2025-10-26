import { useMemo, useRef, useState, type ReactNode } from "react";
import { type Conversation } from "@shared/schema";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Archive, ArchiveRestore, BellOff, Loader2, MoreVertical, Pin, Search } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { NewConversationDialog } from "@/components/NewConversationDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";

type ConversationListProps = {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isLoading?: boolean;
  showArchived?: boolean;
  onToggleArchived?: () => void;
  onArchive?: (id: string, archived: boolean) => void;
  onCreateConversation?: (payload: { phone: string; body?: string }) => void;
  pinnedConversationIds?: string[];
  onTogglePin?: (conversation: Conversation, willPin: boolean) => void;
  maxPinned?: number;
  pinningConversationId?: string | null;
  headerActions?: ReactNode;
  sidebarTitle?: string;
  currentUserName?: string;
};

type ConversationMetadata = {
  lastMessage?: {
    body?: string | null;
    mediaType?: string | null;
    createdAt?: string | null;
  };
  unreadCount?: number;
  muted?: boolean;
  labels?: string[];
};

const formatRelativeTime = (date: string | Date | null | undefined) => {
  if (!date) return "";
  try {
    const parsed = typeof date === "string" ? new Date(date) : date;
    return formatDistanceToNowStrict(parsed, { addSuffix: false });
  } catch {
    return "";
  }
};

const extractMetadata = (conv: Conversation): ConversationMetadata => {
  if (!conv.metadata || typeof conv.metadata !== "object") return {};
  return conv.metadata as ConversationMetadata;
};

const resolveSnippet = (conv: Conversation) => {
  const metadata = extractMetadata(conv);
  const lastMessage = metadata?.lastMessage;
  if (lastMessage?.body) {
    return lastMessage.body;
  }
  if (lastMessage?.mediaType) {
    if (lastMessage.mediaType === "image") return "Photo";
    if (lastMessage.mediaType === "video") return "Video";
    if (lastMessage.mediaType === "audio") return "Audio";
    return "Attachment";
  }
  return conv.phone;
};

const getDisplayName = (conv: Conversation) => conv.displayName || conv.phone;

const getInitials = (conv: Conversation) => {
  const label = conv.displayName || conv.phone || "?";
  return label.slice(0, 2).toUpperCase();
};

const renderSnippet = (text: string, query: string) => {
  if (!query.trim()) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(${escaped})`, "ig");
  const parts = text.split(pattern);
  const lowered = query.trim().toLowerCase();

  return parts.map((part, index) => {
    const isMatch = part.toLowerCase() === lowered;
    return isMatch ? (
      <mark key={`${part}-${index}`} className="rounded-sm bg-primary/20 px-0.5 text-foreground">
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    );
  });
};

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  isLoading,
  showArchived = false,
  onToggleArchived,
  onArchive,
  onCreateConversation,
  pinnedConversationIds = [],
  onTogglePin,
  maxPinned = 10,
  pinningConversationId = null,
  headerActions,
  sidebarTitle = "Chats",
  currentUserName = "You",
}: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const listParentRef = useRef<HTMLDivElement>(null);

  const filteredConversations = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) return conversations;
    return conversations.filter((conv) => {
      const display = (conv.displayName ?? "").toLowerCase();
      const phone = (conv.phone ?? "").toLowerCase();
      const snippet = resolveSnippet(conv).toLowerCase();
      return display.includes(trimmed) || phone.includes(trimmed) || snippet.includes(trimmed);
    });
  }, [conversations, searchQuery]);

  const pinnedSet = useMemo(() => new Set(pinnedConversationIds), [pinnedConversationIds]);
  const pinnedOrdered = useMemo(
    () =>
      pinnedConversationIds
        .map((id) => filteredConversations.find((conv) => conv.id === id))
        .filter((conv): conv is Conversation => Boolean(conv)),
    [filteredConversations, pinnedConversationIds],
  );

  const otherConversations = useMemo(
    () => filteredConversations.filter((conv) => !pinnedSet.has(conv.id)),
    [filteredConversations, pinnedSet],
  );

  const virtualizer = useVirtualizer({
    count: otherConversations.length,
    getScrollElement: () => listParentRef.current,
    estimateSize: () => 82,
    overscan: 8,
  });

  const renderRow = (conv: Conversation, { isPinned }: { isPinned?: boolean }) => {
    const metadata = extractMetadata(conv);
    const unreadCount = metadata?.unreadCount ?? 0;
    const snippet = resolveSnippet(conv);
    const timestamp =
      metadata?.lastMessage?.createdAt ?? conv.lastAt ?? conv.updatedAt ?? conv.createdAt;
    const formattedTime = formatRelativeTime(timestamp);
    const isSelected = selectedId === conv.id;

    return (
      <button
        key={conv.id}
        onClick={() => onSelect(conv.id)}
        onContextMenu={(event) => {
          event.preventDefault();
          if (!onTogglePin) return;
          onTogglePin(conv, !isPinned);
        }}
        className={cn(
          "group relative flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-start transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          isSelected && "bg-muted/70",
        )}
        data-testid={`conversation-row-${conv.id}`}
      >
        <Avatar className="h-11 w-11 flex-shrink-0">
          <AvatarFallback className="bg-primary/15 text-sm font-semibold text-primary">
            {getInitials(conv)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[15px] font-semibold text-foreground">
              {getDisplayName(conv)}
            </p>
            {metadata?.muted && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <BellOff className="h-3 w-3" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">Muted chat</TooltipContent>
              </Tooltip>
            )}
            {isPinned && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-amber-700">
                    <Pin className="h-3 w-3 -rotate-45" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">Pinned</TooltipContent>
              </Tooltip>
            )}
            <span className="ms-auto text-xs text-muted-foreground">{formattedTime}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <p className="line-clamp-1 flex-1 text-[13px] text-muted-foreground">
              {renderSnippet(snippet, searchQuery)}
            </p>
            {unreadCount > 0 && (
              <span className="flex h-5 min-w-[22px] items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          {onTogglePin && (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-8 w-8 text-muted-foreground opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100",
                isPinned && "text-amber-600 hover:text-amber-700",
              )}
              onClick={(event) => {
                event.stopPropagation();
                onTogglePin(conv, !isPinned);
              }}
              disabled={pinningConversationId === conv.id}
              aria-label={isPinned ? "Unpin chat" : "Pin chat"}
            >
              {pinningConversationId === conv.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Pin className={cn("h-4 w-4 transition", isPinned ? "-rotate-45" : "rotate-0")} />
              )}
            </Button>
          )}

          {(onArchive || onTogglePin) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
                  onClick={(event) => event.stopPropagation()}
                  aria-label="Conversation options"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {onTogglePin && (
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      onTogglePin(conv, !isPinned);
                    }}
                  >
                    {isPinned ? "Unpin chat" : "Pin chat"}
                  </DropdownMenuItem>
                )}
                {onArchive && (
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      onArchive(conv.id, !conv.archived);
                    }}
                  >
                    {conv.archived ? (
                      <>
                        <ArchiveRestore className="mr-2 h-4 w-4" />
                        Unarchive
                      </>
                    ) : (
                      <>
                        <Archive className="mr-2 h-4 w-4" />
                        Archive
                      </>
                    )}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </button>
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-full flex-col border-r border-border bg-card/90">
        <div className="border-b border-border/70 px-5 py-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </div>
        <div className="px-5 py-3">
          <Skeleton className="h-9 w-full rounded-full" />
        </div>
        <div className="flex-1 space-y-3 overflow-hidden px-4 py-3">
          {[1, 2, 3, 4, 5].map((item) => (
            <Skeleton key={item} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const emptyState = (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center text-sm text-muted-foreground">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Search className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="mt-4 font-medium">
        {searchQuery.trim()
          ? `No chats matching “${searchQuery}”`
          : showArchived
          ? "No archived chats yet"
          : "No conversations yet"}
      </p>
      <p className="mt-2 text-xs">
        {searchQuery.trim()
          ? "Try refining your search keywords."
          : showArchived
          ? "Archived chats will appear here."
          : "Create a new conversation to get started."}
      </p>
    </div>
  );

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-full min-h-0 flex-col border-r border-border/70 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="border-b border-border/60 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                  {currentUserName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-semibold text-foreground">{currentUserName}</p>
                <p className="text-xs text-muted-foreground">{sidebarTitle}</p>
              </div>
            </div>
            {headerActions ? (
              <div className="flex items-center gap-2">{headerActions}</div>
            ) : null}
          </div>
          <div className="mt-4 space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search or start new chat"
                className="h-10 w-full rounded-full border border-border/70 bg-background/90 pl-10 text-sm shadow-none focus-visible:ring-2 focus-visible:ring-primary"
                data-testid="input-search-conversations"
              />
            </div>
            <div className="flex items-center gap-2">
              {onCreateConversation && (
                <NewConversationDialog
                  onCreateConversation={onCreateConversation}
                  triggerClassName="h-9 flex-1 justify-center rounded-full"
                />
              )}
              {onToggleArchived && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggleArchived}
                  className="h-9 rounded-full border border-border/70 px-3 text-sm"
                  data-testid="button-toggle-archived"
                >
                  {showArchived ? (
                    <>
                      <ArchiveRestore className="mr-2 h-4 w-4" />
                      Active
                    </>
                  ) : (
                    <>
                      <Archive className="mr-2 h-4 w-4" />
                      Archived
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
          {showArchived && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="secondary" className="rounded-full text-[11px] uppercase tracking-wide">
                Viewing archived chats
              </Badge>
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0">
          <div ref={listParentRef} className="h-full overflow-y-auto">
            <div className="flex flex-col gap-4 px-4 py-4">
              {pinnedOrdered.length > 0 && (
                <div className="space-y-2">
                  <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Pinned
                  </p>
                  <div className="space-y-2">
                    {pinnedOrdered.map((conv) => renderRow(conv, { isPinned: true }))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {pinnedOrdered.length > 0 && (
                  <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    All chats
                  </p>
                )}

                {otherConversations.length === 0 ? (
                  pinnedOrdered.length === 0 ? emptyState : null
                ) : (
                  <div
                    style={{
                      height: virtualizer.getTotalSize(),
                      position: "relative",
                    }}
                  >
                    {virtualizer.getVirtualItems().map((virtualRow) => {
                      const conv = otherConversations[virtualRow.index];
                      return (
                        <div
                          key={conv.id}
                          data-index={virtualRow.index}
                          ref={virtualizer.measureElement}
                          className="absolute left-0 right-0"
                          style={{
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                        >
                          {renderRow(conv, { isPinned: false })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
          {filteredConversations.length === 0 && emptyState}
        </div>
      </div>
    </TooltipProvider>
  );
}
