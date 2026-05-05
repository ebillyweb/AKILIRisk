import { describe, it, expect } from "vitest";
import { redactForAudit, shortEmailHash } from "./redact";

describe("redactForAudit", () => {
  describe("secret-shaped keys", () => {
    it("strips password", () => {
      expect(redactForAudit({ password: "hunter2" })).toEqual({
        password: "[REDACTED]",
      });
    });

    it("strips mfaSecret and recoveryCodes", () => {
      expect(
        redactForAudit({
          mfaSecret: "JBSWY3DPEHPK3PXP",
          mfaRecoveryCodes: ["a", "b", "c"],
        })
      ).toEqual({
        mfaSecret: "[REDACTED]",
        mfaRecoveryCodes: "[REDACTED]",
      });
    });

    it("strips any *Token, *Secret variant", () => {
      expect(
        redactForAudit({
          accessToken: "abc",
          refreshToken: "def",
          stripeWebhookSecret: "whsec_xxx",
          sessionToken: "xyz",
        })
      ).toEqual({
        accessToken: "[REDACTED]",
        refreshToken: "[REDACTED]",
        stripeWebhookSecret: "[REDACTED]",
        sessionToken: "[REDACTED]",
      });
    });
  });

  describe("email keys", () => {
    it("hashes plain email", () => {
      const out = redactForAudit({ email: "Test@Example.COM" }) as unknown as {
        email: { emailHash: string };
      };
      expect(out.email.emailHash).toBe(shortEmailHash("test@example.com"));
      expect(out.email.emailHash).toHaveLength(8);
    });

    it("hashes *Email variants (clientEmail, recipientEmail, advisorEmail, prefillEmail)", () => {
      const hash = shortEmailHash("a@b.com");
      expect(
        redactForAudit({
          clientEmail: "a@b.com",
          recipientEmail: "a@b.com",
          advisorEmail: "a@b.com",
          prefillEmail: "a@b.com",
        })
      ).toEqual({
        clientEmail: { emailHash: hash },
        recipientEmail: { emailHash: hash },
        advisorEmail: { emailHash: hash },
        prefillEmail: { emailHash: hash },
      });
    });

    it("preserves null/undefined email values", () => {
      expect(redactForAudit({ email: null, clientEmail: undefined })).toEqual({
        email: null,
        clientEmail: undefined,
      });
    });

    it("redacts non-string values in email fields (defensive)", () => {
      expect(redactForAudit({ email: 12345 })).toEqual({
        email: "[REDACTED]",
      });
    });
  });

  describe("string truncation", () => {
    it("truncates strings over 500 chars", () => {
      const long = "x".repeat(600);
      const out = redactForAudit({ transcript: long }) as {
        transcript: string;
      };
      expect(out.transcript.length).toBe(500 + "…[truncated]".length);
      expect(out.transcript.endsWith("…[truncated]")).toBe(true);
    });

    it("leaves strings under 500 chars alone", () => {
      const short = "hello world";
      expect(redactForAudit({ note: short })).toEqual({ note: short });
    });
  });

  describe("recursion", () => {
    it("recurses into nested objects", () => {
      const out = redactForAudit({
        user: { id: "u1", password: "secret", profile: { name: "Jane" } },
      });
      expect(out).toEqual({
        user: {
          id: "u1",
          password: "[REDACTED]",
          profile: { name: "Jane" },
        },
      });
    });

    it("recurses into arrays", () => {
      expect(
        redactForAudit({
          users: [
            { id: "u1", email: "a@b.com" },
            { id: "u2", email: "c@d.com" },
          ],
        })
      ).toEqual({
        users: [
          { id: "u1", email: { emailHash: shortEmailHash("a@b.com") } },
          { id: "u2", email: { emailHash: shortEmailHash("c@d.com") } },
        ],
      });
    });

    it("passes through primitives at the top level", () => {
      expect(redactForAudit("hello")).toBe("hello");
      expect(redactForAudit(42)).toBe(42);
      expect(redactForAudit(null)).toBe(null);
    });
  });
});
