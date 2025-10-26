import { cn } from "@/lib/utils";
import React from "react";

interface ChatLayoutProps {
  header: React.ReactNode;
  messageList: React.ReactNode;
  composer: React.ReactNode;
  className?: string;
}

export function ChatLayout({ header, messageList, composer, className }: ChatLayoutProps) {
  return (
    <div className={cn("flex h-[100dvh] flex-col overflow-hidden bg-background", className)}>
      {/* Fixed Header */}
      <div className="fixed inset-x-0 top-0 z-30 border-b border-border/70 bg-card/95 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-card/80">
        {header}
      </div>

      {/* Scrollable Message Area */}
      <div 
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{
          marginTop: '56px', // Header height
          marginBottom: '68px', // Composer base height
          height: 'calc(100dvh - 124px)', // Full height minus header and composer
        }}
      >
        <div className="relative h-full">
          {messageList}
        </div>
      </div>

      {/* Fixed Composer at Bottom */}
      <div 
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-card/95 backdrop-blur-md supports-[backdrop-filter]:bg-card/80 transform-gpu"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)',
          willChange: 'transform',
        }}
      >
        {composer}
      </div>
    </div>
  );
}