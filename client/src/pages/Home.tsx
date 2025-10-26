import { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { type Conversation } from "@shared/schema";
import { ConversationList } from "@/components/ConversationList";
import { MessageThread } from "@/components/MessageThread";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import { Button } from "@/components/ui/button";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Settings } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { type ChatMessage } from "@/types/messages";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { ConversationInfoDrawer } from "@/components/chat/ConversationInfoDrawer";

const MAX_PINNED_CONVERSATIONS = 10;

type MobilePanel = "list" | "conversation";

export default function Home() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [pendingPinId, setPendingPinId] = useState<string | null>(null);
  const [isInfoDrawerOpen, setIsInfoDrawerOpen] = useState(false);
  const [activeMobilePanel, setActiveMobilePanel] = useState<MobilePanel>("list");

  const { toast } = useToast();
  const { user } = useAuth();
  const canDeleteMessages = user?.role === "admin";

  const isTablet = useMediaQuery("(min-width: 768px)");
  const isLargeDesktop = useMediaQuery("(min-width: 1200px)");

  const handleWebSocketMessage = useCallback((event: string, data: any) => {
    if (
      event === "message_incoming" ||
      event === "message_outgoing" ||
      event === "message_media_updated"
    ) {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });

      if (data.conversationId) {
        queryClient.invalidateQueries({
          queryKey: ["/api/conversations", data.conversationId, "messages"],
        });
      }
    }

    if (event === "message_deleted") {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });

      if (data?.conversationId) {
        queryClient.invalidateQueries({
          queryKey: ["/api/conversations", data.conversationId, "messages"],
        });
      }
    }
  }, []);

  useWebSocket({
    onMessage: handleWebSocketMessage,
  });

  const { data: conversationsData, isLoading: conversationsLoading } = useQuery<{
    total: number;
    items: Conversation[];
  }>({
    queryKey: ["/api/conversations", { archived: showArchived }],
    queryFn: async () => {
      const res = await fetch(`/api/conversations?archived=${showArchived}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const conversations = conversationsData?.items ?? [];
  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId],
  );

  const { data: pinnedData } = useQuery<{
    pins: Array<{ conversationId: string; pinnedAt: string }>;
  }>({
    queryKey: ["/api/conversations/pins"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/conversations/pins");
      return await res.json();
    },
  });

  const pinnedConversationIds = pinnedData?.pins?.map((pin) => pin.conversationId) ?? [];

  const {
    data: messagesData,
    isLoading: messagesLoading,
  } = useQuery<{ total: number; items: ChatMessage[] }>({
    queryKey: ["/api/conversations", selectedConversationId, "messages"],
    enabled: Boolean(selectedConversationId),
  });

  const messages = messagesData?.items ?? [];

  const sendMessageMutation = useMutation({
    mutationFn: async ({
      to,
      body,
      mediaUrl,
      conversationId,
      replyToMessageId,
    }: {
      to: string;
      body: string;
      mediaUrl?: string;
      conversationId: string;
      replyToMessageId?: string;
    }) => {
      return await apiRequest("POST", "/api/message/send", {
        to,
        body,
        media_url: mediaUrl,
        conversationId,
        replyToMessageId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      if (selectedConversationId) {
        queryClient.invalidateQueries({
          queryKey: ["/api/conversations", selectedConversationId, "messages"],
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send message",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      return await apiRequest("PATCH", `/api/conversations/${id}/archive`, { archived });
    },
    onSuccess: (_data, variables) => {
      if (selectedConversationId === variables.id) {
        setSelectedConversationId(null);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      toast({
        title: variables.archived ? "Conversation archived" : "Conversation unarchived",
        description: variables.archived
          ? "The conversation has been moved to archived"
          : "The conversation has been restored to active",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to archive conversation",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMessageMutation = useMutation<{ ok: boolean; conversationId?: string }, Error, string>({
    mutationFn: async (messageId: string) => {
      const res = await apiRequest("DELETE", `/api/messages/${messageId}`);
      return await res.json();
    },
    onSuccess: (data) => {
      if (data?.conversationId) {
        queryClient.invalidateQueries({
          queryKey: ["/api/conversations", data.conversationId, "messages"],
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      toast({
        title: "Message deleted",
        description: "The message has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete message",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteConversationMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      await apiRequest("DELETE", `/api/conversations/${conversationId}`);
    },
    onSuccess: () => {
      setSelectedConversationId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      toast({
        title: "Conversation deleted",
        description: "All messages in the conversation have been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete conversation",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const pinMutation = useMutation({
    mutationFn: async ({ conversationId, pinned }: { conversationId: string; pinned: boolean }) => {
      const res = await apiRequest("POST", `/api/conversations/${conversationId}/pin`, { pinned });
      return await res.json();
    },
    onMutate: ({ conversationId }) => {
      setPendingPinId(conversationId);
    },
    onSuccess: (data: any) => {
      if (data?.pins) {
        queryClient.setQueryData(["/api/conversations/pins"], data);
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/conversations/pins"] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Unable to update pin",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setPendingPinId(null);
    },
  });

  const createConversationMutation = useMutation({
    mutationFn: async ({ phone, body }: { phone: string; body?: string }) => {
      const res = await apiRequest("POST", "/api/conversations", { phone });
      return res.json();
    },
    onSuccess: (data: any, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      if (data.conversation?.id) {
        setSelectedConversationId(data.conversation.id);
        if (!isTablet) {
          setActiveMobilePanel("conversation");
        }
      }
      const trimmedBody = variables.body?.trim();
      if (trimmedBody && data.conversation?.id) {
        sendMessageMutation.mutate({
          to: data.conversation.phone ?? variables.phone,
          body: trimmedBody,
          conversationId: data.conversation.id,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to start conversation",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!isLargeDesktop) {
      setIsInfoDrawerOpen(false);
    }
  }, [isLargeDesktop]);

  useEffect(() => {
    if (!selectedConversationId) {
      setIsInfoDrawerOpen(false);
      if (!isTablet) {
        setActiveMobilePanel("list");
      }
    }
  }, [selectedConversationId, isTablet]);

  const handleSelectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    if (!isTablet) {
      setActiveMobilePanel("conversation");
    }
  };

  const handleTogglePinConversation = (conversation: Conversation, willPin: boolean) => {
    if (
      willPin &&
      !pinnedConversationIds.includes(conversation.id) &&
      pinnedConversationIds.length >= MAX_PINNED_CONVERSATIONS
    ) {
      toast({
        title: "Pin limit reached",
        description: "You can only pin up to 10 chats.",
        variant: "destructive",
      });
      return;
    }

    pinMutation.mutate({ conversationId: conversation.id, pinned: willPin });
  };

  const handleSendMessage = async (
    body: string,
    mediaUrl?: string,
    replyToMessageId?: string | null,
  ) => {
    if (!selectedConversation) {
      throw new Error("No conversation selected");
    }
    await sendMessageMutation.mutateAsync({
      to: selectedConversation.phone,
      body,
      mediaUrl,
      conversationId: selectedConversation.id,
    replyToMessageId: replyToMessageId ?? undefined,
  });
  };

  const handleDeleteConversation = async () => {
    if (!selectedConversation) return;
    await deleteConversationMutation.mutateAsync(selectedConversation.id);
  };

  const headerActions = (
    <div className="flex items-center gap-1.5">
      <Button
        variant="ghost"
        size="icon"
        asChild
        className="text-muted-foreground hover:text-foreground"
        aria-label="Open settings"
        data-testid="button-settings"
      >
        <Link href="/settings">
          <Settings className="h-5 w-5" />
        </Link>
      </Button>
      <ThemeToggle />
      <UserMenu />
    </div>
  );

  const gridTemplate = isTablet
    ? cn(
        "grid h-full min-h-0 w-full overflow-hidden rounded-none bg-card/95 backdrop-blur shadow-xl shadow-black/5 supports-[backdrop-filter]:bg-card/90 md:rounded-[28px]",
        isLargeDesktop && isInfoDrawerOpen && selectedConversation
          ? "grid-cols-[360px_minmax(0,1fr)_340px]"
          : "grid-cols-[360px_minmax(0,1fr)]",
      )
    : "flex h-full min-h-0 flex-col overflow-hidden rounded-none bg-card/95 backdrop-blur shadow-xl shadow-black/5 supports-[backdrop-filter]:bg-card/90 md:rounded-[28px]";

  const infoDrawerShouldRender = Boolean(selectedConversation);

  return (
    <div className="relative flex flex-1 min-h-0 w-full overflow-hidden bg-[#111b21] text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-emerald-500/30 to-transparent" />
      <div className="relative z-10 flex min-h-0 flex-1 overflow-hidden px-0 py-0 md:px-4 md:py-6">
        {isTablet ? (
          <div className={gridTemplate}>
            <ConversationList
              conversations={conversations}
              selectedId={selectedConversationId}
              onSelect={handleSelectConversation}
              isLoading={conversationsLoading}
              showArchived={showArchived}
              onToggleArchived={() => setShowArchived((value) => !value)}
              onArchive={(id, archived) => archiveMutation.mutate({ id, archived })}
              onCreateConversation={createConversationMutation.mutate}
              pinnedConversationIds={pinnedConversationIds}
              onTogglePin={handleTogglePinConversation}
              maxPinned={MAX_PINNED_CONVERSATIONS}
              pinningConversationId={pendingPinId}
              headerActions={headerActions}
              sidebarTitle="Chats"
              currentUserName={user?.username ?? "You"}
            />

            <div className="flex min-h-0 flex-col border-r border-border/60">
              <MessageThread
                conversation={selectedConversation}
                messages={messages}
                onSendMessage={handleSendMessage}
                isLoading={messagesLoading}
                isSending={sendMessageMutation.isPending}
                canManageMessages={canDeleteMessages}
                onDeleteMessage={
                  canDeleteMessages
                    ? (messageId: string) => deleteMessageMutation.mutateAsync(messageId)
                    : undefined
                }
                deletingMessageId={deleteMessageMutation.variables ?? null}
                isDeletingMessage={deleteMessageMutation.isPending}
                onDeleteConversation={
                  canDeleteMessages && selectedConversation ? handleDeleteConversation : undefined
                }
                isDeletingConversation={deleteConversationMutation.isPending}
                showMobileHeader={!isTablet}
                headerActions={headerActions}
                onToggleInfoDrawer={setIsInfoDrawerOpen}
                isInfoDrawerOpen={isInfoDrawerOpen}
              />
            </div>

            {isLargeDesktop && infoDrawerShouldRender && isInfoDrawerOpen && (
              <ConversationInfoDrawer
                conversation={selectedConversation}
                messages={messages}
                isOpen={isInfoDrawerOpen}
                onClose={() => setIsInfoDrawerOpen(false)}
                mode="desktop"
              />
            )}
            {!isLargeDesktop && (
              <ConversationInfoDrawer
                conversation={selectedConversation}
                messages={messages}
                isOpen={isInfoDrawerOpen && infoDrawerShouldRender}
                onClose={() => setIsInfoDrawerOpen(false)}
                mode="overlay"
              />
            )}
          </div>
        ) : (
          <div className={gridTemplate}>
            {activeMobilePanel === "list" ? (
              <ConversationList
                conversations={conversations}
                selectedId={selectedConversationId}
                onSelect={handleSelectConversation}
                isLoading={conversationsLoading}
                showArchived={showArchived}
                onToggleArchived={() => setShowArchived((value) => !value)}
                onArchive={(id, archived) => archiveMutation.mutate({ id, archived })}
                onCreateConversation={createConversationMutation.mutate}
                pinnedConversationIds={pinnedConversationIds}
                onTogglePin={handleTogglePinConversation}
                maxPinned={MAX_PINNED_CONVERSATIONS}
                pinningConversationId={pendingPinId}
                headerActions={headerActions}
                sidebarTitle="Chats"
                currentUserName={user?.username ?? "You"}
              />
            ) : (
              <MessageThread
                conversation={selectedConversation}
                messages={messages}
                onSendMessage={handleSendMessage}
                isLoading={messagesLoading}
                isSending={sendMessageMutation.isPending}
                canManageMessages={canDeleteMessages}
                onDeleteMessage={
                  canDeleteMessages
                    ? (messageId: string) => deleteMessageMutation.mutateAsync(messageId)
                    : undefined
                }
                deletingMessageId={deleteMessageMutation.variables ?? null}
                isDeletingMessage={deleteMessageMutation.isPending}
                onDeleteConversation={
                  canDeleteMessages && selectedConversation ? handleDeleteConversation : undefined
                }
                isDeletingConversation={deleteConversationMutation.isPending}
                onBackToList={() => setActiveMobilePanel("list")}
                showMobileHeader
                headerActions={headerActions}
                onToggleInfoDrawer={setIsInfoDrawerOpen}
                isInfoDrawerOpen={isInfoDrawerOpen}
              />
            )}

            <ConversationInfoDrawer
              conversation={selectedConversation}
              messages={messages}
              isOpen={activeMobilePanel === "conversation" && isInfoDrawerOpen && infoDrawerShouldRender}
              onClose={() => setIsInfoDrawerOpen(false)}
              mode="compact"
            />
          </div>
        )}
      </div>
    </div>
  );
}
