// Unit tests for the file-upload helpers (Phase 4.1).
//
// `uploadFile` itself wraps `XMLHttpRequest` and is exercised by
// integration paths (the compose-box tests mock `apiClient.uploadFile`
// directly). The pure helpers — `sanitiseLinkText`, `isImageType`,
// `uploadToMarkdown` — get full coverage here.

import { describe, expect, it } from "vitest";
import { isImageType, sanitiseLinkText, uploadToMarkdown } from "./upload";

describe("sanitiseLinkText", () => {
  it("passes ordinary filenames through unchanged", () => {
    expect(sanitiseLinkText("report.pdf")).toBe("report.pdf");
  });

  it("replaces square brackets with their fullwidth counterparts", () => {
    // `[` and `]` would break the surrounding Markdown link; the
    // server documentation explicitly recommends this substitution.
    expect(sanitiseLinkText("v[2].txt")).toBe("v［2］.txt");
  });
});

describe("isImageType", () => {
  it("detects common image MIME types", () => {
    expect(isImageType("image/png")).toBe(true);
    expect(isImageType("image/jpeg")).toBe(true);
    expect(isImageType("image/svg+xml")).toBe(true);
  });

  it("returns false for non-image types and the empty string", () => {
    expect(isImageType("application/pdf")).toBe(false);
    expect(isImageType("text/plain")).toBe(false);
    expect(isImageType("")).toBe(false);
  });
});

describe("uploadToMarkdown", () => {
  it("renders an image upload as the inline `![text](url)` form", () => {
    const md = uploadToMarkdown(
      { url: "/user_uploads/1/abc/photo.png", filename: "photo.png" },
      true,
    );
    expect(md).toBe("![photo.png](/user_uploads/1/abc/photo.png)");
  });

  it("renders a non-image upload as a plain `[text](url)` link", () => {
    const md = uploadToMarkdown(
      { url: "/user_uploads/1/abc/report.pdf", filename: "report.pdf" },
      false,
    );
    expect(md).toBe("[report.pdf](/user_uploads/1/abc/report.pdf)");
  });

  it("escapes brackets in the filename so the link does not break", () => {
    const md = uploadToMarkdown(
      { url: "/user_uploads/1/x/file.txt", filename: "file[1].txt" },
      false,
    );
    expect(md).toBe("[file［1］.txt](/user_uploads/1/x/file.txt)");
  });
});
