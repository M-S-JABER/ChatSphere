import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatBytes, isImage } from "@/lib/attachmentUtils";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Eye, FileText, Loader2, Paperclip, X } from "lucide-react";

export type AttachmentUploadStatus = "pending" | "uploading" | "success" | "error";

export type AttachmentUploadState = {
  status: AttachmentUploadStatus;
  progress: number;
  error?: string;
};

export type Attachment = {
  id: string;
  file: File;
  kind: "image" | "file";
  name: string;
  mime: string;
  size: number;
  previewUrl?: string;
  uploadState?: AttachmentUploadState;
};

export type AttachmentBarProps = {
  attachments: Attachment[];
  onRemove: (id: string) => void;
};

type PreviewState =
  | {
      attachment: Attachment;
      content: string | null;
      loading: boolean;
      error?: string;
      open: true;
    }
  | { open: false };

const MAX_PREVIEW_CHARS = 2000;

const readFileAsText = (file: File): Promise<string> => {
  if (typeof file.text === "function") {
    return file.text();
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("Unable to read file."));
    };
    reader.readAsText(file);
  });
};

const isPreviewableText = (attachment: Attachment) => {
  const mime = attachment.mime;
  if (mime.startsWith("text/")) return true;
  if (mime === "application/json") return true;
  const name = attachment.name.toLowerCase();
  return [".txt", ".md", ".csv", ".json"].some((ext) => name.endsWith(ext));
};

export function AttachmentBar({ attachments, onRemove }: AttachmentBarProps) {
  const [previewState, setPreviewState] = useState<PreviewState>({ open: false });

  const closePreview = () => setPreviewState({ open: false });

  const handleOpenPreview = async (attachment: Attachment) => {
    if (!isPreviewableText(attachment)) return;
    setPreviewState({ attachment, content: null, loading: true, open: true });

    try {
      const text = await readFileAsText(attachment.file);
      const content = text.slice(0, MAX_PREVIEW_CHARS);
      setPreviewState((prev) =>
        prev.open && prev.attachment.id === attachment.id
          ? { attachment, content, loading: false, open: true }
          : prev,
      );
    } catch (error: any) {
      setPreviewState((prev) =>
        prev.open && prev.attachment.id === attachment.id
          ? {
              attachment,
              content: null,
              loading: false,
              error: error?.message ?? "Unable to read file.",
              open: true,
            }
          : prev,
      );
    }
  };

  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2" aria-live="polite">
      <div className="flex flex-wrap gap-2">
        {attachments.map((attachment) => {
          const isImg = isImage(attachment.mime) || attachment.kind === "image";
          const uploadState: AttachmentUploadState = attachment.uploadState ?? {
            status: "pending",
            progress: 0,
          };
          const isUploading = uploadState.status === "uploading";
          const isSuccess = uploadState.status === "success";
          const isError = uploadState.status === "error";

          return (
            <div
              key={attachment.id}
              className={cn(
                "group relative flex min-w-[220px] items-center gap-3 rounded-xl border bg-card/70 px-3 py-2 shadow-sm",
                "focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2",
                "border-border/60",
                isUploading && "border-primary/40",
                isSuccess && "border-emerald-400/60 bg-emerald-50/60 dark:bg-emerald-500/10",
                isError && "border-destructive/60 bg-destructive/10",
              )}
            >
              {isImg ? (
                <div className="h-12 w-12 overflow-hidden rounded-lg border border-border/40 bg-muted">
                  {attachment.previewUrl ? (
                    <img
                      src={attachment.previewUrl}
                      alt={attachment.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <Paperclip className="h-5 w-5" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border/40 bg-muted text-muted-foreground">
                  <FileText className="h-5 w-5" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground" title={attachment.name}>
                  {attachment.name}
                </p>
                <p className="text-xs text-muted-foreground">{formatBytes(attachment.size)}</p>
                <div
                  className={cn(
                    "mt-1 flex items-center gap-1 text-xs",
                    isError
                      ? "text-destructive"
                      : isSuccess
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-muted-foreground",
                  )}
                  aria-live="polite"
                >
                  {isUploading && (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      <span>Uploading {uploadState.progress}%</span>
                    </>
                  )}
                  {isSuccess && (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                      <span>Sent</span>
                    </>
                  )}
                  {isError && (
                    <>
                      <AlertCircle className="h-3.5 w-3.5" aria-hidden />
                      <span>{uploadState.error ?? "Upload failed"}</span>
                    </>
                  )}
                  {!isUploading && !isSuccess && !isError && (
                    <span className="text-muted-foreground">Ready to send</span>
                  )}
                </div>
              </div>

              {isPreviewableText(attachment) && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="rounded-full text-muted-foreground hover:text-foreground"
                  onClick={() => handleOpenPreview(attachment)}
                  aria-label={`Preview ${attachment.name}`}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              )}

              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="rounded-full text-muted-foreground hover:text-destructive"
                onClick={() => onRemove(attachment.id)}
                aria-label={`Remove ${attachment.name}`}
                data-testid={`attachment-remove-${attachment.id}`}
              >
                <X className="h-4 w-4" />
              </Button>

              {isUploading && (
                <div className="absolute inset-x-0 bottom-0 h-1 rounded-b-xl bg-primary/15">
                  <div
                    className="h-full rounded-b-xl bg-primary transition-[width]"
                    style={{ width: `${Math.min(Math.max(uploadState.progress, 0), 100)}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={previewState.open} onOpenChange={(open) => !open && closePreview()}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>{previewState.open ? previewState.attachment.name : "Preview"}</DialogTitle>
            <DialogDescription>
              {previewState.open ? formatBytes(previewState.attachment.size) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 max-h-[60vh] overflow-auto rounded border border-border/60 bg-muted/40 p-4 text-sm font-mono whitespace-pre-wrap">
            {previewState.open && previewState.loading && <p>Loading preview…</p>}
            {previewState.open && previewState.error && (
              <p className="text-destructive">{previewState.error}</p>
            )}
            {previewState.open && !previewState.loading && !previewState.error && (
              <>{previewState.content}</>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
