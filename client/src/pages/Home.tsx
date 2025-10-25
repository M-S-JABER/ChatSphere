import { useState, useCallback } from "react";
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

const MAX_PINNED_CONVERSATIONS = 10;

export default function Home() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [pendingPinId, setPendingPinId] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const canDeleteMessages = user?.role === "admin";

  const handleWebSocketMessage = useCallback((event: string, data: any) => {
    if (event === "message_incoming" || event === "message_outgoing" || event === "message_media_updated") {
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

  const conversations = conversationsData?.items || [];
  const selectedConversation = conversations.find((c) => c.id === selectedConversationId) || null;

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

  const { data: messagesData, isLoading: messagesLoading } = useQuery<{
    total: number;
    items: ChatMessage[];
  }>({
    queryKey: ["/api/conversations", selectedConversationId, "messages"],
    enabled: !!selectedConversationId,
  });

  const messages = messagesData?.items || [];

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
    onSuccess: (data: any, variables) => {
      if (data?.pins) {
        queryClient.setQueryData(["/api/conversations/pins"], data);
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/conversations/pins"] });
      }

      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });

      toast({
        title: variables.pinned ? "Conversation pinned" : "Conversation unpinned",
        description: variables.pinned
          ? "This chat is now pinned to the top."
          : "The chat has been removed from your pinned list.",
      });
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

  const createConversationMutation = useMutation({
    mutationFn: async ({ phone, body }: { phone: string; body?: string }) => {
      const res = await apiRequest("POST", "/api/conversations", { phone });
      return res.json();
    },
    onSuccess: (data: any, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      if (data.conversation?.id) {
        setSelectedConversationId(data.conversation.id);
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

  const handleCreateConversation = (payload: { phone: string; body?: string }) => {
    createConversationMutation.mutate(payload);
  };

  const handleDeleteConversation = async () => {
    if (!selectedConversation) return;
    await deleteConversationMutation.mutateAsync(selectedConversation.id);
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

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <div className="w-full lg:w-[420px] flex-shrink-0">
        <ConversationList
          conversations={conversations}
          selectedId={selectedConversationId}
          onSelect={setSelectedConversationId}
          isLoading={conversationsLoading}
          showArchived={showArchived}
          onToggleArchived={() => setShowArchived(!showArchived)}
          onArchive={(id, archived) => archiveMutation.mutate({ id, archived })}
          onCreateConversation={handleCreateConversation}
          pinnedConversationIds={pinnedConversationIds}
          onTogglePin={handleTogglePinConversation}
          pinningConversationId={pendingPinId}
          maxPinned={MAX_PINNED_CONVERSATIONS}
        />
      </div>

      <div className="flex-1 relative">
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          <Link href="/settings">
            <Button variant="ghost" size="icon" data-testid="button-settings">
              <Settings className="h-5 w-5" />
            </Button>
          </Link>
          <ThemeToggle />
          <UserMenu />
        </div>
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
        />
      </div>

    </div>
  );
}
