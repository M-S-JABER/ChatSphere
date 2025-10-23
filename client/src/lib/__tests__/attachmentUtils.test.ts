import { describe, it, expect } from "vitest";
import { formatBytes, isImage, validateFiles } from "../attachmentUtils";

const makeFile = (name: string, sizeBytes: number, type: string): File => {
  const blob = new Blob([new Uint8Array(sizeBytes)], { type });
  return new File([blob], name, { type, lastModified: Date.now() });
};

describe("formatBytes", () => {
  it("formats small numbers", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1 KB");
  });

  it("formats larger numbers with decimals", () => {
    expect(formatBytes(10 * 1024)).toBe("10 KB");
    expect(formatBytes(1.5 * 1024 * 1024)).toBe("1.5 MB");
  });
});

describe("isImage", () => {
  it("detects image mimetypes", () => {
    expect(isImage("image/png")).toBe(true);
    expect(isImage("image/jpeg")).toBe(true);
  });

  it("returns false for non images", () => {
    expect(isImage("application/pdf")).toBe(false);
    expect(isImage("")).toBe(false);
  });
});

describe("validateFiles", () => {
  it("accepts files within limits", () => {
    const files = [
      makeFile("photo.png", 2 * 1024 * 1024, "image/png"),
      makeFile("doc.pdf", 1 * 1024 * 1024, "application/pdf"),
    ];

    const { accepted, rejected } = validateFiles(files, { currentCount: 0, maxFiles: 5 });
    expect(accepted).toHaveLength(2);
    expect(rejected).toHaveLength(0);
  });

  it("rejects files over size limit", () => {
    const largeFile = makeFile("video.mp4", 30 * 1024 * 1024, "video/mp4");
    const { accepted, rejected } = validateFiles([largeFile], { maxFileSizeMB: 5 });
    expect(accepted).toHaveLength(0);
    expect(rejected[0]?.reason).toContain("limit");
  });

  it("rejects when attachment limit reached", () => {
    const files = [makeFile("photo.png", 1024, "image/png")];
    const { accepted, rejected } = validateFiles(files, { maxFiles: 1, currentCount: 1 });
    expect(accepted).toHaveLength(0);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason.toLowerCase()).toContain("limit");
  });

  it("rejects unsupported types", () => {
    const csv = makeFile("data.xlsm", 1024, "application/vnd.ms-excel.sheet.binary.macroenabled.12");
    const { accepted, rejected } = validateFiles([csv], {
      acceptedTypes: ["image/*"],
    });
    expect(accepted).toHaveLength(0);
    expect(rejected).toHaveLength(1);
  });
});
