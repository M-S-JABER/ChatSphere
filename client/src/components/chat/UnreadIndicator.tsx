import { cn } from "@/lib/utils";

interface UnreadIndicatorProps {
  count?: number;
  className?: string;
}

export function UnreadIndicator({ count, className }: UnreadIndicatorProps) {
  if (!count) return null;

  return (
    <div
      className={cn(
        "absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-medium text-white shadow-sm",
        count > 99 && "min-w-[22px]",
        className
      )}
      aria-label={`${count} unread messages`}
    >
      {count > 99 ? "99+" : count}
    </div>
  );
}