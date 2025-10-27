import { memo } from 'react';
import { cn } from '@/lib/utils';

interface MessageListWrapperProps {
  children: React.ReactNode;
  className?: string;
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
  scrollRef?: React.RefObject<HTMLDivElement>;
}

export const MessageListWrapper = memo(function MessageListWrapper({
  children,
  className,
  onScroll,
  scrollRef,
}: MessageListWrapperProps) {
  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className={cn(
        "relative h-full w-full overflow-y-auto overscroll-contain scroll-smooth",
        "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted/20 hover:scrollbar-thumb-muted/30",
        "touch-pan-y",
        className
      )}
      style={{
        WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
        transform: 'translate3d(0,0,0)', // Force GPU acceleration
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* WhatsApp Web style: single scrollable area, no extra wrappers */}
      {children}
    </div>
  );
});