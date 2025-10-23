import { type Conversation, type Message } from "@shared/schema";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MoreVertical, Trash2 } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { ChatComposer, type ChatComposerHandle } from "./chat/ChatComposer";
import { ChatDropZone } from "./chat/ChatDropZone";
import { type Attachment as ComposerAttachment } from "./chat/AttachmentBar";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface MessageThreadProps {
  conversation: Conversation | null;
  messages: Message[];
  onSendMessage: (body: string, mediaUrl?: string) => Promise<void> | void;
  isLoading?: boolean;
  isSending?: boolean;
  canManageMessages?: boolean;
  onDeleteMessage?: (messageId: string) => Promise<unknown>;
  deletingMessageId?: string | null;
  isDeletingMessage?: boolean;
  onDeleteConversation?: () => Promise<void>;
  isDeletingConversation?: boolean;
}

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
}: MessageThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [messagePendingDeletion, setMessagePendingDeletion] = useState<Message | null>(null);
  const [deleteConversationOpen, setDeleteConversationOpen] = useState(false);
  const composerRef = useRef<ChatComposerHandle>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  const uploadAttachment = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data = await response.json();
    return data.publicUrl ?? data.url;
  };

  const handleComposerSend = async ({
    text,
    attachments: composerAttachments,
  }: {
    text: string;
    attachments: ComposerAttachment[];
  }) => {
    if (!conversation) {
      throw new Error("No conversation selected");
    }

    const trimmed = text.trim();

    if (trimmed) {
      await Promise.resolve(onSendMessage(trimmed, undefined));
    }

    for (const attachment of composerAttachments) {
      try {
        const mediaUrl = await uploadAttachment(attachment.file);
        await Promise.resolve(onSendMessage("", mediaUrl));
      } catch (error: any) {
        toast({
          title: "Upload failed",
          description: error?.message ?? "Unable to upload attachment.",
          variant: "destructive",
        });
        throw error;
      }
    }
  };

  const allowMessageDeletion = Boolean(canManageMessages && onDeleteMessage);

  const handleConfirmDelete = async () => {
    if (!messagePendingDeletion || !onDeleteMessage) return;

    try {
      await onDeleteMessage(messagePendingDeletion.id);
      setMessagePendingDeletion(null);
    } catch (error) {
      // Parent mutation surfaces toast; keep dialog open for retry.
      console.error(error);
    }
  };

  if (!conversation) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background">
        <div className="w-64 h-64 mb-8 opacity-10">
          <svg viewBox="0 0 303 172" fill="none" className="w-full h-full">
            <path
              d="M118.6 77.8L145.5 50.9c1.7-1.7 4.4-1.7 6.1 0l26.9 26.9c1.7 1.7 1.7 4.4 0 6.1l-26.9 26.9c-1.7 1.7-4.4 1.7-6.1 0l-26.9-26.9c-1.7-1.7-1.7-4.4 0-6.1z"
              fill="currentColor"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-light text-foreground mb-2">WhatsApp Web</h2>
        <p className="text-sm text-muted-foreground text-center max-w-md px-4">
          Send and receive messages without keeping your phone online.
          <br />
          Select a conversation to start messaging.
        </p>
      </div>
    );
  }

  const getInitials = (phone: string, name?: string | null) => {
    if (name) return name.charAt(0).toUpperCase();
    return phone.charAt(phone.length - 1);
  };

  const getDisplayName = () => {
    return conversation.displayName || conversation.phone;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <div className="p-3 border-b border-border bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 p-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
              <Skeleton className={`h-16 rounded-lg ${i % 2 === 0 ? "w-64" : "w-48"}`} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background relative">
      <div className="p-3 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary text-primary-foreground">
                {getInitials(conversation.phone, conversation.displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h2 className="font-medium text-foreground">{getDisplayName()}</h2>
                {onDeleteConversation && (
                  <AlertDialog open={deleteConversationOpen} onOpenChange={setDeleteConversationOpen}>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Delete conversation"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete entire conversation?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove all messages in this conversation. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={async () => {
                            if (!onDeleteConversation) return;
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
                          {isDeletingConversation ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-mono">{conversation.phone}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" data-testid="button-menu">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      <ChatDropZone
        onDropFiles={handleDropFiles}
        onDropText={handleDropText}
        disabled={!conversation}
        className="flex flex-1 flex-col"
      >
        <div
          className="flex-1 overflow-y-auto p-4 bg-background relative"
          style={{
            backgroundImage: `repeating-linear-gradient(
              45deg,
              transparent,
              transparent 10px,
              hsl(var(--border) / 0.03) 10px,
              hsl(var(--border) / 0.03) 11px
            )`,
          }}
        >
          <ScrollArea className="h-full" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-16">
                <div className="w-16 h-16 rounded-full bg-card flex items-center justify-center mb-4 shadow-sm">
                  <svg viewBox="0 0 24 24" className="w-8 h-8 text-primary" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
                  </svg>
                </div>
                <p className="text-sm text-muted-foreground mb-1">No messages yet</p>
                <p className="text-xs text-muted-foreground">Start the conversation by sending a message</p>
              </div>
            ) : (
              <div className="space-y-2">
                {messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    canDelete={allowMessageDeletion}
                    onDelete={allowMessageDeletion ? () => setMessagePendingDeletion(message) : undefined}
                    isDeleting={Boolean(
                      allowMessageDeletion && isDeletingMessage && deletingMessageId === message.id
                    )}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>
        </div>
        <ChatComposer
          ref={composerRef}
          onSend={handleComposerSend}
          disabled={isSending || !conversation}
        />
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
                ? `This will permanently remove the message "${messagePendingDeletion.body.slice(0, 100)}"${
                    messagePendingDeletion.body.length > 100 ? "..." : ""
                  }.`
                : "This will permanently remove the selected message."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={
                Boolean(
                  isDeletingMessage &&
                    deletingMessageId &&
                    messagePendingDeletion &&
                    deletingMessageId === messagePendingDeletion.id
                )
              }
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
    </div>
  );
}
