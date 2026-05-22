import { describe, it, expect } from "vitest";
import {
  createInvitationSchema,
  DEFAULT_INVITATION_PERSONAL_MESSAGE,
} from "./invitation";

/** US-1 — Send a Client Invitation (Advisor) acceptance criteria */
describe("createInvitationSchema (US-1)", () => {
  it("normalizes client email: trim and lower-case", () => {
    const result = createInvitationSchema.parse({
      clientEmail: "  Client@Example.COM  ",
    });
    expect(result.clientEmail).toBe("client@example.com");
  });

  it("uses the default personal message when omitted", () => {
    const result = createInvitationSchema.parse({
      clientEmail: "client@example.com",
    });
    expect(result.personalMessage).toBe(DEFAULT_INVITATION_PERSONAL_MESSAGE);
  });

  it("uses the default personal message when blank or whitespace only", () => {
    expect(
      createInvitationSchema.parse({
        clientEmail: "client@example.com",
        personalMessage: "",
      }).personalMessage
    ).toBe(DEFAULT_INVITATION_PERSONAL_MESSAGE);

    expect(
      createInvitationSchema.parse({
        clientEmail: "client@example.com",
        personalMessage: "   \n\t  ",
      }).personalMessage
    ).toBe(DEFAULT_INVITATION_PERSONAL_MESSAGE);
  });

  it("keeps a custom personal message when provided", () => {
    const custom = "Looking forward to working with your family.";
    const result = createInvitationSchema.parse({
      clientEmail: "client@example.com",
      personalMessage: custom,
    });
    expect(result.personalMessage).toBe(custom);
  });

  it("defaults intakeWaived to false", () => {
    const result = createInvitationSchema.parse({
      clientEmail: "client@example.com",
    });
    expect(result.intakeWaived).toBe(false);
  });

  it("accepts intakeWaived true", () => {
    const result = createInvitationSchema.parse({
      clientEmail: "client@example.com",
      intakeWaived: true,
    });
    expect(result.intakeWaived).toBe(true);
  });

  it("trims optional client name and drops empty values", () => {
    expect(
      createInvitationSchema.parse({
        clientEmail: "client@example.com",
        clientName: "  Jane Doe  ",
      }).clientName
    ).toBe("Jane Doe");

    expect(
      createInvitationSchema.parse({
        clientEmail: "client@example.com",
        clientName: "   ",
      }).clientName
    ).toBeUndefined();
  });
});
