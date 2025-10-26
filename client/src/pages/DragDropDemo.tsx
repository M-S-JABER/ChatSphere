import { useRef, useState } from "react";
import { ChatComposer, type ChatComposerHandle } from "@/components/chat/ChatComposer";
import { ChatDropZone } from "@/components/chat/ChatDropZone";
import { type Attachment } from "@/components/chat/AttachmentBar";
import { formatBytes } from "@/lib/attachmentUtils";

type Submission = {
  id: number;
  text: string;
  attachments: Attachment[];
};

export default function DragDropDemo() {
  const composerRef = useRef<ChatComposerHandle>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [counter, setCounter] = useState(0);

  const handleSend = async (payload: { text: string; attachments: Attachment[] }) => {
    console.log("DragDropDemo payload", payload);
    setSubmissions((prev) => [
      {
        id: counter + 1,
        text: payload.text,
        attachments: payload.attachments.map((attachment) => ({ ...attachment })),
      },
      ...prev,
    ]);
    setCounter((value) => value + 1);
  };

  const handleDropFiles = (files: File[]) => {
    composerRef.current?.addAttachments(files);
  };

  const handleDropText = (text: string) => {
    composerRef.current?.insertText(text);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex h-full max-w-4xl flex-col gap-6 p-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">Drag &amp; Drop Demo</h1>
          <p className="text-sm text-muted-foreground">
            Drop files or text anywhere in the highlighted area, paste images from your clipboard, or use the attach
            button. Press send to log the payload below.
          </p>
        </header>

        <ChatDropZone
          onDropFiles={handleDropFiles}
          onDropText={handleDropText}
          className="flex-1 rounded-lg border border-border bg-card"
        >
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Try the following:</p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li>Drag multiple images or documents from your desktop.</li>
                <li>Drag highlighted text from another tab to insert it into the composer.</li>
                <li>Paste a screenshot from the clipboard (Cmd/Ctrl + V).</li>
              </ul>
            </div>

            {submissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Send something to see the payload log.</p>
            ) : (
              <div className="space-y-3">
                {submissions.map((submission) => (
                  <div key={submission.id} className="rounded-lg border border-border/60 bg-background/80 p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Submission #{submission.id}</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm">{submission.text || "(no text)"}</p>
                    {submission.attachments.length > 0 && (
                      <ul className="mt-3 space-y-1 text-sm">
                        {submission.attachments.map((attachment) => (
                          <li key={attachment.id} className="flex items-center justify-between gap-3">
                            <span className="truncate" title={attachment.name}>
                              {attachment.name}
                            </span>
                            <span className="text-xs text-muted-foreground">{formatBytes(attachment.size)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <ChatComposer ref={composerRef} onSend={handleSend} />
        </ChatDropZone>
      </div>
    </div>
  );
}
