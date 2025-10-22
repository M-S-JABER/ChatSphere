import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { type Conversation, type Message } from "@shared/schema";
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

export default function Home() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const canDeleteMessages = user?.role === "admin";

  const handleWebSocketMessage = useCallback((event: string, data: any) => {
    if (event === "message_incoming" || event === "message_outgoing") {
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

  const { data: messagesData, isLoading: messagesLoading } = useQuery<{
    total: number;
    items: Message[];
  }>({
    queryKey: ["/api/conversations", selectedConversationId, "messages"],
    enabled: !!selectedConversationId,
  });

  const messages = messagesData?.items || [];

  const sendMessageMutation = useMutation({
    mutationFn: async ({ to, body, mediaUrl }: { to: string; body: string; mediaUrl?: string }) => {
      return await apiRequest("POST", "/api/message/send", { to, body, media_url: mediaUrl });
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

  const handleSendMessage = (body: string, mediaUrl?: string) => {
    if (!selectedConversation) return;
    sendMessageMutation.mutate({
      to: selectedConversation.phone,
      body,
      mediaUrl,
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
      if (trimmedBody) {
        sendMessageMutation.mutate({
          to: data.conversation?.phone ?? variables.phone,
          body: trimmedBody,
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
        />
      </div>

    </div>
  );
}
