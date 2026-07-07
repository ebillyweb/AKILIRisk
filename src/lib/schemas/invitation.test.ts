import { describe, it, expect } from "vitest";
import {
  createInvitationSchema,
  buildDefaultInvitationPersonalMessage,
} from "./invitation";

/** US-1 — Send a Client Invitation (Advisor) acceptance criteria */
describe("createInvitationSchema (US-1)", () => {
  it("normalizes client email: trim and lower-case", () => {
    const result = createInvitationSchema.parse({
      clientEmail: "  Client@Example.COM  ",
    });
    expect(result.clientEmail).toBe("client@example.com");
  });

  it("leaves personal message undefined when omitted", () => {
    const result = createInvitationSchema.parse({
      clientEmail: "client@example.com",
    });
    expect(result.personalMessage).toBeUndefined();
  });

  it("leaves personal message undefined when blank or whitespace only", () => {
    expect(
      createInvitationSchema.parse({
        clientEmail: "client@example.com",
        personalMessage: "",
      }).personalMessage
    ).toBeUndefined();

    expect(
      createInvitationSchema.parse({
        clientEmail: "client@example.com",
        personalMessage: "   \n\t  ",
      }).personalMessage
    ).toBeUndefined();
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

  it("accepts intakeWaived true with assessment domains", () => {
    const result = createInvitationSchema.parse({
      clientEmail: "client@example.com",
      intakeWaived: true,
      includedPillars: ["governance", "cyber-digital"],
    });
    expect(result.intakeWaived).toBe(true);
    expect(result.includedPillars).toEqual(["governance", "cyber-digital"]);
  });

  it("requires assessment domains when intakeWaived is true", () => {
    const result = createInvitationSchema.safeParse({
      clientEmail: "client@example.com",
      intakeWaived: true,
    });
    expect(result.success).toBe(false);
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

describe("buildDefaultInvitationPersonalMessage", () => {
  it("includes the advisor firm name when provided", () => {
    expect(buildDefaultInvitationPersonalMessage("Belvedere Wealth")).toBe(
      "Belvedere Wealth is inviting you to complete your family's Risk Profile. This confidential process will help us identify areas of risk that require action plans to protect your wealth for the long term"
    );
  });

  it("lists selected assessment domains when scope is provided", () => {
    expect(
      buildDefaultInvitationPersonalMessage("Belvedere Wealth", [
        "governance",
        "insurance",
        "geographic-environmental",
      ]),
    ).toBe(
      "Belvedere Wealth is inviting you to complete 3 Risk Profile Assessments in Governance & Decision-Making, Protection & Risk Transfer and Geographic & Environmental. This confidential process will help us identify areas of risk that require action plans to protect your wealth for the long term",
    );
  });

  it("uses singular assessment label for one domain", () => {
    expect(
      buildDefaultInvitationPersonalMessage("Belvedere Wealth", ["governance"]),
    ).toContain("1 Risk Profile Assessment in Governance & Decision-Making.");
  });

  it("falls back when firm name is missing", () => {
    expect(buildDefaultInvitationPersonalMessage(null)).toContain(
      "Your advisor is inviting you"
    );
  });
});
