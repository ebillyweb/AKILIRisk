import { describe, expect, it } from "vitest";
import {
  sanitizeSupportAttachmentFilename,
  validateSupportTicketAttachment,
} from "./attachment";

describe("sanitizeSupportAttachmentFilename", () => {
  it("strips unsafe characters and keeps extension", () => {
    expect(
      sanitizeSupportAttachmentFilename("screen shot.png", "image/png")
    ).toBe("screen-shot.png");
    expect(
      sanitizeSupportAttachmentFilename("../../evil.jpg", "image/jpeg")
    ).toBe("..-..-evil.jpg");
  });

  it("adds extension when missing", () => {
    expect(sanitizeSupportAttachmentFilename("shot", "image/webp")).toBe(
      "support-attachment.webp"
    );
  });
});

describe("validateSupportTicketAttachment", () => {
  it("accepts a small png payload", () => {
    const result = validateSupportTicketAttachment({
      filename: "doc.png",
      contentType: "image/png",
      contentBase64: Buffer.from("hello").toString("base64"),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.filename).toBe("doc.png");
      expect(result.contentType).toBe("image/png");
    }
  });

  it("rejects disallowed types and oversized payloads", () => {
    expect(
      validateSupportTicketAttachment({
        filename: "a.pdf",
        contentType: "application/pdf",
        contentBase64: "YQ==",
      }).ok
    ).toBe(false);

    const huge = "A".repeat(Math.ceil((4 * 1024 * 1024 * 4) / 3) + 16);
    expect(
      validateSupportTicketAttachment({
        filename: "big.png",
        contentType: "image/png",
        contentBase64: huge,
      }).ok
    ).toBe(false);
  });
});
