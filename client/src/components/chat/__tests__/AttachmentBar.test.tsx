import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AttachmentBar, type Attachment } from "../AttachmentBar";

const makeAttachment = (overrides: Partial<Attachment> = {}): Attachment => {
  const file = overrides.file ?? new File(["hello"], overrides.name ?? "note.txt", { type: overrides.mime ?? "text/plain" });
  return {
    id: overrides.id ?? "att-1",
    file,
    kind: overrides.kind ?? "file",
    name: overrides.name ?? file.name,
    mime: overrides.mime ?? file.type,
    size: overrides.size ?? file.size,
    previewUrl: overrides.previewUrl,
  };
};

describe("AttachmentBar", () => {
  it("renders attachment chips and handles removal", () => {
    const attachments = [makeAttachment({ name: "document.pdf", mime: "application/pdf" })];
    const handleRemove = vi.fn();

    render(<AttachmentBar attachments={attachments} onRemove={handleRemove} />);

    expect(screen.getByText("document.pdf")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /remove document.pdf/i }));
    expect(handleRemove).toHaveBeenCalledWith("att-1");
  });

  it("opens preview dialog for text attachments", async () => {
    const attachments = [makeAttachment({ id: "att-2", name: "notes.txt", mime: "text/plain" })];
    const handleRemove = vi.fn();

    render(<AttachmentBar attachments={attachments} onRemove={handleRemove} />);

    fireEvent.click(screen.getByRole("button", { name: /preview notes.txt/i }));

    await waitFor(() => {
      expect(screen.getByText(/hello/i)).toBeInTheDocument();
    });
  });
});
