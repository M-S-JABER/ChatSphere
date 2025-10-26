import { useCallback, useMemo, useRef, useState } from "react";
import { readDroppedText } from "@/lib/attachmentUtils";
import { cn } from "@/lib/utils";

type ChatDropZoneProps = {
  onDropFiles: (files: File[]) => void;
  onDropText: (text: string) => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function ChatDropZone({
  onDropFiles,
  onDropText,
  disabled,
  className,
  children,
}: ChatDropZoneProps) {
  const [isActive, setIsActive] = useState(false);
  const dragCounterRef = useRef(0);

  const isTouch = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  }, []);

  const resetDragState = useCallback(() => {
    dragCounterRef.current = 0;
    setIsActive(false);
  }, []);

  const handleDragEnter = useCallback(
    (event: React.DragEvent) => {
      if (disabled) return;
      const items = Array.from(event.dataTransfer?.items ?? []);
      const hasRelevantData = items.some(
        (item) => item.kind === "file" || item.kind === "string",
      );
      if (!hasRelevantData) {
        return;
      }

      dragCounterRef.current += 1;
      event.preventDefault();
      event.stopPropagation();
      if (!isTouch) {
        setIsActive(true);
      }
    },
    [disabled, isTouch],
  );

  const handleDragOver = useCallback(
    (event: React.DragEvent) => {
      if (disabled) return;
      const items = Array.from(event.dataTransfer?.items ?? []);
      const hasRelevantData = items.some(
        (item) => item.kind === "file" || item.kind === "string",
      );
      if (!hasRelevantData) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "copy";
    },
    [disabled],
  );

  const handleDragLeave = useCallback(
    (event: React.DragEvent) => {
      if (disabled) return;
      event.preventDefault();
      event.stopPropagation();

      dragCounterRef.current -= 1;
      if (dragCounterRef.current <= 0) {
        resetDragState();
      }
    },
    [disabled, resetDragState],
  );

  const handleDrop = useCallback(
    async (event: React.DragEvent) => {
      if (disabled) return;
      event.preventDefault();
      event.stopPropagation();

      const dataTransfer = event.dataTransfer;
      const fileSet = new Set<File>();

      if (dataTransfer?.items) {
        for (const item of Array.from(dataTransfer.items)) {
          if (item.kind === "file") {
            const file = item.getAsFile();
            if (file) {
              fileSet.add(file);
            }
          }
        }
      }

      if (fileSet.size === 0 && dataTransfer?.files) {
        for (const file of Array.from(dataTransfer.files)) {
          fileSet.add(file);
        }
      }

      if (fileSet.size > 0) {
        onDropFiles(Array.from(fileSet));
      }

      const text = await readDroppedText(dataTransfer);
      if (text) {
        onDropText(text);
      }

      resetDragState();
    },
    [disabled, onDropFiles, onDropText, resetDragState],
  );

  return (
    <div
      role="region"
      aria-label="Drop files to attach"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn("relative flex h-full min-h-0 flex-col", className)}
    >
      {children}
      {isActive && !isTouch && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/10 backdrop-blur-sm transition">
          <div className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow">
            Drop to attach
          </div>
        </div>
      )}
    </div>
  );
}
