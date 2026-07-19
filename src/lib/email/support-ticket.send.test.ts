import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sendMock } = vi.hoisted(() => ({
  sendMock: vi.fn().mockResolvedValue({ data: { id: "email_test" }, error: null }),
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: (...args: unknown[]) => sendMock(...args),
    };
  },
}));

import { sendSupportTicketEmail } from "./support-ticket";

describe("sendSupportTicketEmail", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.FROM_EMAIL = "hello@mail.akilirisk.com";
    process.env.SUPPORT_TICKET_TO_EMAIL = "support@akilirisk.com";
    sendMock.mockClear();
    sendMock.mockResolvedValue({ data: { id: "email_test" }, error: null });
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("builds a Resend payload without calling the real API", async () => {
    const result = await sendSupportTicketEmail({
      name: "Ada Advisor",
      email: "advisor@test.com",
      category: "technical",
      subject: "Screenshot of the error",
      message: "Here is an image of the document that fails to upload.",
      userId: "user_smoke_1",
      userRole: "ADVISOR",
      attachment: {
        filename: "doc-shot.png",
        contentType: "image/png",
        contentBase64: Buffer.from("fake-png-bytes").toString("base64"),
      },
    });

    expect(result).toEqual({ success: true });
    expect(sendMock).toHaveBeenCalledTimes(1);

    const payload = sendMock.mock.calls[0]?.[0] as {
      to: string;
      from: string;
      replyTo: string;
      subject: string;
      html: string;
      attachments?: Array<{
        filename?: string;
        content?: string;
        contentType?: string;
        contentId?: string;
      }>;
    };

    expect(payload.to).toBe("support@akilirisk.com");
    expect(payload.from).toBe("hello@mail.akilirisk.com");
    expect(payload.replyTo).toBe("advisor@test.com");
    expect(payload.subject).toMatch(/\[Support\].*Technical issue/i);
    expect(payload.html).toContain("Screenshot of the error");
    expect(payload.html).toContain("doc-shot.png");
    expect(payload.html).not.toContain("mailto:");

    const userAttachment = payload.attachments?.find(
      (attachment) => attachment.filename === "doc-shot.png"
    );
    expect(userAttachment).toBeTruthy();
    expect(userAttachment?.contentType).toBe("image/png");
    expect(userAttachment?.content).toBe(
      Buffer.from("fake-png-bytes").toString("base64")
    );
    expect(userAttachment?.contentId).toBeUndefined();
  });

  it("returns a configuration error when RESEND_API_KEY is missing", async () => {
    delete process.env.RESEND_API_KEY;

    const result = await sendSupportTicketEmail({
      name: "Ada Advisor",
      email: "advisor@test.com",
      category: "other",
      subject: "No key",
      message: "This should not attempt a send.",
      userId: "user_smoke_2",
      userRole: "ADVISOR",
    });

    expect(result.success).toBe(false);
    expect(sendMock).not.toHaveBeenCalled();
  });
});
