import { Fragment, useMemo } from "react";
import type { Conversation } from "@shared/schema";
import type { ChatMessage } from "@/types/messages";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  FileText,
  Globe,
  Image as ImageIcon,
  Info,
  Link2,
  Phone,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type ConversationInfoDrawerProps = {
  conversation: Conversation | null;
  messages: ChatMessage[];
  isOpen: boolean;
  onClose: () => void;
  mode: "desktop" | "overlay" | "compact";
};

type LinkEntry = {
  id: string;
  url: string;
  text: string;
  timestamp: string;
};

const urlPattern =
  /(https?:\/\/(?:www\.)?[a-zA-Z0-9._%+-]+(?:\.[a-zA-Z]{2,})+(?:[/?#][^\s]*)?)/gi;

const parseLinks = (messages: ChatMessage[]): LinkEntry[] => {
  const results: LinkEntry[] = [];

  for (const message of messages) {
    if (!message.body) continue;
    const matches = message.body.match(urlPattern);
    if (!matches) continue;

    for (const url of matches) {
      results.push({
        id: `${message.id}-${url}`,
        url,
        text: message.body.trim().slice(0, 120),
        timestamp: message.createdAt ? new Date(message.createdAt).toISOString() : "",
      });
    }
  }

  return results;
};

const safeMetadata = (conversation: Conversation | null) => {
  const raw = conversation?.metadata;
  if (!raw || typeof raw !== "object") return {};
  return raw as Record<string, any>;
};

export function ConversationInfoDrawer({
  conversation,
  messages,
  isOpen,
  onClose,
  mode,
}: ConversationInfoDrawerProps) {
  const metadata = useMemo(() => safeMetadata(conversation), [conversation]);
  const mediaMessages = useMemo(
    () =>
      messages.filter((message) => {
        const media = message.media as any;
        return media && ["image", "video"].includes(media.type);
      }),
    [messages],
  );

  const fileMessages = useMemo(
    () =>
      messages.filter((message) => {
        const media = message.media as any;
        return media && media.type === "document";
      }),
    [messages],
  );

  const linkMessages = useMemo(() => parseLinks(messages), [messages]);

  const drawerClasses = cn(
    "flex h-full w-full flex-col border-l border-border/70 bg-card/95 text-sm backdrop-blur supports-[backdrop-filter]:bg-card/80 transition-transform duration-200 ease-out",
    mode === "desktop" && "max-w-[320px]",
    mode === "overlay" && "max-w-md shadow-xl",
    mode === "compact" && "max-w-full shadow-xl",
    !isOpen && (mode === "desktop" ? "translate-x-full" : "translate-y-full sm:translate-x-full"),
  );

  if (!conversation) {
    return null;
  }

  const lastSeenRaw = metadata?.lastSeenAt;
  const lastSeen =
    typeof lastSeenRaw === "string"
      ? format(new Date(lastSeenRaw), "PPp")
      : lastSeenRaw instanceof Date
      ? format(lastSeenRaw, "PPp")
      : null;
  const about = metadata?.about || "This contact hasn’t shared any details yet.";

  const content = (
    <div className={drawerClasses} role="complementary" aria-label="Conversation details">
      <header className="flex items-center justify-between border-b border-border/60 px-5 py-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary/10 text-primary">
              {(conversation.displayName ?? conversation.phone ?? "?")
                .slice(0, 2)
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {conversation.displayName ?? conversation.phone}
            </p>
            <p className="text-xs text-muted-foreground">Chat info</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
          onClick={onClose}
          aria-label="Close info drawer"
        >
          <X className="h-5 w-5" />
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <Tabs defaultValue="about" className="flex h-full flex-col">
          <TabsList className="sticky top-0 mb-4 bg-card/95">
            <TabsTrigger value="about" className="text-xs">
              <Info className="mr-2 h-4 w-4" />
              About
            </TabsTrigger>
            <TabsTrigger value="media" className="text-xs">
              <ImageIcon className="mr-2 h-4 w-4" />
              Media
            </TabsTrigger>
            <TabsTrigger value="files" className="text-xs">
              <FileText className="mr-2 h-4 w-4" />
              Files
            </TabsTrigger>
            <TabsTrigger value="links" className="text-xs">
              <Link2 className="mr-2 h-4 w-4" />
              Links
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="about"
            className="flex-1 space-y-5 focus-visible:outline-none"
          >
            <section className="space-y-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Display name
                </p>
                <p className="text-sm text-foreground">
                  {conversation.displayName ?? "Unknown"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Phone</p>
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono">{conversation.phone}</span>
                </div>
              </div>
              {metadata?.status && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Status
                  </p>
                  <p className="text-sm text-foreground">{metadata.status}</p>
                </div>
              )}
              {lastSeen && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Last seen
                  </p>
                  <p className="text-sm text-foreground">{lastSeen}</p>
                </div>
              )}
            </section>

            <Separator />

            <section className="space-y-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">About</p>
              <p className="text-sm leading-6 text-muted-foreground">{about}</p>
              {Array.isArray(metadata?.labels) && metadata.labels.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {metadata.labels.map((label: string) => (
                    <Badge key={label} variant="secondary" className="rounded-full px-3 py-1">
                      {label}
                    </Badge>
                  ))}
                </div>
              )}
            </section>

            {metadata?.website && (
              <>
                <Separator />
                <section className="space-y-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Website
                  </p>
                  <a
                    href={metadata.website as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <Globe className="h-4 w-4" />
                    {metadata.website}
                  </a>
                </section>
              </>
            )}
          </TabsContent>

          <TabsContent value="media" className="focus-visible:outline-none">
            {mediaMessages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Media shared in this chat will appear here.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {mediaMessages.map((message) => {
                  const media = message.media as any;
                  const previewUrl = media.thumbnailUrl ?? media.previewUrl ?? media.url;
                  return (
                    <a
                      key={message.id}
                      href={media.url ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative overflow-hidden rounded-lg border border-border/50 bg-muted/40"
                    >
                      {previewUrl ? (
                        <img
                          src={previewUrl}
                          alt={media.filename ?? "Shared media"}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-32 items-center justify-center text-muted-foreground">
                          <ImageIcon className="h-8 w-8" />
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent px-3 py-2 text-xs text-white">
                        {media.filename ?? "untitled"}
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="files" className="focus-visible:outline-none">
            {fileMessages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Files shared here will be listed for quick access.
              </p>
            ) : (
              <div className="space-y-2">
                {fileMessages.map((message) => {
                  const media = message.media as any;
                  return (
                    <a
                      key={message.id}
                      href={media.url ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm transition hover:bg-muted hover:shadow-sm"
                    >
                      <div className="flex items-center gap-3 truncate">
                        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">
                            {media.filename ?? "Document"}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {media.extension?.toUpperCase() ?? "Unknown"}{" "}
                            {media.sizeBytes ? `• ${(media.sizeBytes / 1024).toFixed(1)} KB` : ""}
                          </p>
                        </div>
                      </div>
                      <Download className="h-4 w-4 text-muted-foreground" />
                    </a>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="links" className="focus-visible:outline-none">
            {linkMessages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Links will be collected here automatically.
              </p>
            ) : (
              <div className="space-y-3">
                {linkMessages.map((link) => (
                  <Fragment key={link.id}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col gap-1 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm transition hover:bg-muted hover:shadow-sm"
                    >
                      <span className="inline-flex items-center gap-2 text-primary">
                        <Link2 className="h-4 w-4" />
                        {link.url}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {link.text}
                      </span>
                      <span className="text-[11px] uppercase text-muted-foreground">
                        {link.timestamp ? format(new Date(link.timestamp), "PP p") : ""}
                      </span>
                    </a>
                  </Fragment>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );

  if (mode === "desktop") {
    return content;
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-[70] flex sm:items-stretch sm:justify-end",
        isOpen ? "pointer-events-auto" : "pointer-events-none",
      )}
    >
      <div
        className={cn(
          "absolute inset-0 bg-background/60 backdrop-blur-sm transition-opacity",
          isOpen ? "opacity-100" : "opacity-0",
        )}
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative ms-auto flex h-full w-full sm:w-[420px]",
          mode === "compact" ? "sm:w-full" : "sm:max-w-md",
        )}
      >
        {content}
      </div>
    </div>
  );
}
