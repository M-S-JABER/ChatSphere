import { cn } from "@/lib/utils";
import React from "react";

interface ChatLayoutProps {
  header: React.ReactNode;
  messageList: React.ReactNode;
  composer: React.ReactNode;
  className?: string;
}

export function ChatLayout({ header, messageList, composer, className }: ChatLayoutProps) {
  // WhatsApp Web style: sticky header, main area with padding, fixed composer
  const HEADER_HEIGHT = 64; // px
  const COMPOSER_HEIGHT = 64; // px
  return (
    <div className={cn("relative flex h-[100dvh] flex-col bg-background", className)}>
      {/* Sticky Header */}
      <header
        className="sticky top-0 z-40 border-b border-border/70 bg-card/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80"
        style={{
          height: HEADER_HEIGHT,
          minHeight: HEADER_HEIGHT,
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        {header}
      </header>

      {/* Scrollable Message Area */}
      <main 
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{
          paddingTop: HEADER_HEIGHT,
          paddingBottom: `calc(${COMPOSER_HEIGHT}px + env(safe-area-inset-bottom))`,
          backgroundImage: "var(--chat-thread-wallpaper)",
          backgroundSize: "240px 240px",
        }}
      >
        <div className="relative min-h-full w-full py-2">
          {messageList}
        </div>
      </main>

      {/* Fixed Composer at Bottom */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80"
        style={{
          height: COMPOSER_HEIGHT,
          minHeight: COMPOSER_HEIGHT,
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {composer}
      </div>
    </div>
  );
}