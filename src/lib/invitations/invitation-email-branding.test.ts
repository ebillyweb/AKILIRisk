import { describe, expect, it } from "vitest";
import { invitationFirmDisplayName } from "./invitation-email-branding";

describe("invitationFirmDisplayName", () => {
  it("prefers advisorFirmName over brandName when branding is resolved", () => {
    expect(
      invitationFirmDisplayName(
        { firmName: "Test Advisor Firm", brandName: null },
        { brandName: "Buddy Wealth", advisorFirmName: "Live Firm Name" },
      ),
    ).toBe("Live Firm Name");
  });

  it("falls back to profile firmName then brandName", () => {
    expect(
      invitationFirmDisplayName({
        firmName: "Test Advisor Firm",
        brandName: "Updated Brand",
      }),
    ).toBe("Test Advisor Firm");

    expect(
      invitationFirmDisplayName({
        firmName: null,
        brandName: "Solo Brand",
      }),
    ).toBe("Solo Brand");
  });
});
