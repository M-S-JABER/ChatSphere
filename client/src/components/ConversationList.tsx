import { useState } from "react";
import { type Conversation } from "@shared/schema";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, Archive, ArchiveRestore, MoreVertical, Pin, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { NewConversationDialog } from "@/components/NewConversationDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ConversationListProps {
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
}

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
}: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const getInitials = (phone: string, name?: string | null) => {
    if (name) return name.charAt(0).toUpperCase();
    return phone.charAt(phone.length - 1);
  };

  const getDisplayName = (conv: Conversation) => {
    return conv.displayName || conv.phone;
  };

  const formatTimestamp = (date: string | Date | null) => {
    if (!date) return "";
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: false });
    } catch {
      return "";
    }
  };

  const filteredConversations = conversations.filter((conv) => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) return true;
    
    const query = trimmedQuery.toLowerCase();
    const phone = conv.phone.toLowerCase();
    const displayName = (conv.displayName || "").toLowerCase();
    
    return phone.includes(query) || displayName.includes(query);
  });

  const pinnedSet = new Set(pinnedConversationIds);
  const pinnedOrdered = pinnedConversationIds
    .map((id) => filteredConversations.find((conv) => conv.id === id))
    .filter((conv): conv is Conversation => Boolean(conv));
  const otherConversations = filteredConversations.filter((conv) => !pinnedSet.has(conv.id));
  const orderedConversations = [...pinnedOrdered, ...otherConversations];

  const firstPinnedId = pinnedOrdered[0]?.id;
  const firstUnpinnedId = otherConversations[0]?.id;

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen border-r border-border bg-card">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-5 w-32" />
          </div>
        </div>
        <div className="p-3">
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
        <div className="flex-1 p-2 space-y-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-3 space-y-2">
              <div className="flex gap-3">
                <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex flex-col h-screen border-r border-border bg-card">
      <div className="p-4 border-b border-border space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-medium text-foreground">Messages</h1>
          <div className="flex items-center gap-2">
            {onCreateConversation && (
              <NewConversationDialog
                onCreateConversation={onCreateConversation}
                triggerClassName="h-9 px-3"
              />
            )}
            {onToggleArchived && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleArchived}
                className="gap-2"
                data-testid="button-toggle-archived"
              >
                {showArchived ? (
                  <>
                    <ArchiveRestore className="h-4 w-4" />
                    <span className="text-sm">Active</span>
                  </>
                ) : (
                  <>
                    <Archive className="h-4 w-4" />
                    <span className="text-sm">Archived</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
        {showArchived && (
          <div className="mt-2">
            <Badge variant="secondary" className="text-xs">
              Viewing Archived Conversations
            </Badge>
          </div>
        )}
      </div>

      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search or start new chat"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary border-none rounded-lg h-10"
            data-testid="input-search-conversations"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {orderedConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
              {searchQuery.trim() ? (
                <Search className="h-8 w-8 text-muted-foreground" />
              ) : showArchived ? (
                <Archive className="h-8 w-8 text-muted-foreground" />
              ) : (
                <Search className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {searchQuery.trim() 
                ? "No conversations found"
                : showArchived 
                ? "No archived conversations" 
                : "No conversations yet"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {searchQuery.trim()
                ? `No results for "${searchQuery}"`
                : showArchived 
                ? "Archived conversations will appear here" 
                : "Send a message to start chatting"}
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {orderedConversations.map((conv) => {
              const isPinned = pinnedSet.has(conv.id);
              const showPinnedLabel = isPinned && conv.id === firstPinnedId;
              const showOthersLabel = !isPinned && firstUnpinnedId === conv.id && pinnedOrdered.length > 0;
              const pinLimitReachedForThisChat = !isPinned && pinnedOrdered.length >= maxPinned;

              return (
                <div key={conv.id} className="space-y-1">
                  {showPinnedLabel && (
                    <div className="px-3 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Pinned
                    </div>
                  )}
                  {showOthersLabel && (
                    <div className="px-3 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      All chats
                    </div>
                  )}

                  <div className="relative group">
                    <button
                      onClick={() => onSelect(conv.id)}
                      className={`w-full p-3 pr-16 rounded-lg hover-elevate active-elevate-2 text-left transition-colors ${
                        selectedId === conv.id ? "bg-sidebar-accent" : ""
                      } ${isPinned ? "ring-1 ring-amber-400/40" : ""}`}
                      data-testid={`button-conversation-${conv.id}`}
                    >
                      <div className="flex gap-3">
                        <Avatar className="h-12 w-12 flex-shrink-0">
                          <AvatarFallback className="bg-primary text-primary-foreground font-medium text-base">
                            {getInitials(conv.phone, conv.displayName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2 mb-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <h3 className="font-medium text-foreground truncate text-base">
                                {getDisplayName(conv)}
                              </h3>
                              {isPinned && (
                                <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600">
                                  Pinned
                                </span>
                              )}
                            </div>
                            {conv.lastAt && (
                              <span className="ml-auto text-xs text-muted-foreground flex-shrink-0">
                                {formatTimestamp(conv.lastAt)}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground font-mono truncate">
                            {conv.phone}
                          </p>
                        </div>
                      </div>
                    </button>

                    <div className="absolute right-2 top-2 flex items-center gap-1">
                      {onTogglePin && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-8 w-8 transition-all ${
                                isPinned
                                  ? "text-amber-600 hover:text-amber-700 hover:bg-amber-500/20 bg-amber-500/15"
                                  : "text-muted-foreground hover:text-primary"
                              }`}
                              onClick={(event) => {
                                event.stopPropagation();
                                onTogglePin(conv, !isPinned);
                              }}
                              disabled={pinningConversationId === conv.id}
                              aria-disabled={pinLimitReachedForThisChat}
                              aria-pressed={isPinned}
                              aria-label={isPinned ? `Unpin ${getDisplayName(conv)}` : `Pin ${getDisplayName(conv)}`}
                              data-testid={`button-pin-${conv.id}`}
                            >
                              {pinningConversationId === conv.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Pin
                                  className={`h-4 w-4 transition-transform duration-200 ${
                                    isPinned ? "-rotate-45" : "rotate-0"
                                  }`}
                                />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            <p>
                              {isPinned
                                ? "Unpin chat"
                                : pinLimitReachedForThisChat
                                ? `Pin chat (limit ${maxPinned})`
                                : "Pin chat"}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      )}

                      {onArchive && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              data-testid={`button-conversation-menu-${conv.id}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                onArchive(conv.id, !conv.archived);
                              }}
                              data-testid={`button-archive-${conv.id}`}
                            >
                              {conv.archived ? (
                                <>
                                  <ArchiveRestore className="mr-2 h-4 w-4" />
                                  <span>Unarchive</span>
                                </>
                              ) : (
                                <>
                                  <Archive className="mr-2 h-4 w-4" />
                                  <span>Archive</span>
                                </>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
      </div>
    </TooltipProvider>
  );
}
