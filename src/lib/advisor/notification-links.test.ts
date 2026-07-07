import { describe, expect, it } from "vitest";
import { advisorNotificationHref } from "@/lib/advisor/notification-links";

describe("advisorNotificationHref", () => {
  it("routes NEW_LEAD notifications to the lead detail page", () => {
    expect(
      advisorNotificationHref({ type: "NEW_LEAD", referenceId: "lead-123" })
    ).toBe("/advisor/leads/lead-123");
  });

  it("routes NEW_INTAKE notifications to intake review", () => {
    expect(
      advisorNotificationHref({ type: "NEW_INTAKE", referenceId: "intake-1" })
    ).toBe("/advisor/review/intake-1");
  });

  it("routes enterprise provision SYSTEM notifications to billing", () => {
    expect(
      advisorNotificationHref({
        type: "SYSTEM",
        referenceId: "enterprise-active:ent-123",
      }),
    ).toBe("/advisor/billing");
  });

  it("falls back to the notifications hub", () => {
    expect(advisorNotificationHref({ type: "SYSTEM", referenceId: null })).toBe(
      "/advisor/notifications"
    );
  });
});
