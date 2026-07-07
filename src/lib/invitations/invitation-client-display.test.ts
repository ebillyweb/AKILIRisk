import { describe, expect, it } from "vitest";

import {
  formatInvitationHistoryClientLabel,
  PENDING_CLIENT_REFERENCE_LABEL,
} from "@/lib/invitations/invitation-client-display";

describe("formatInvitationHistoryClientLabel", () => {
  it("shows name and email in standard mode", () => {
    expect(
      formatInvitationHistoryClientLabel({
        pseudonymousWorkspaceLabeling: false,
        clientName: "Jordan Smith",
        prefillEmail: "jordan@example.com",
        clientReferenceCode: "CL-8F3K-29QX",
      }),
    ).toEqual({
      primary: "Jordan Smith",
      secondary: "jordan@example.com",
      pseudonymous: false,
    });
  });

  it("shows client reference in pseudonymous mode when registered", () => {
    expect(
      formatInvitationHistoryClientLabel({
        pseudonymousWorkspaceLabeling: true,
        clientName: "Jordan Smith",
        prefillEmail: "jordan@example.com",
        clientReferenceCode: "CL-8F3K-29QX",
      }),
    ).toEqual({
      primary: "Client CL-8F3K-29QX",
      secondary: null,
      pseudonymous: true,
    });
  });

  it("shows pending label before registration", () => {
    expect(
      formatInvitationHistoryClientLabel({
        pseudonymousWorkspaceLabeling: true,
        clientName: "Jordan Smith",
        prefillEmail: "jordan@example.com",
        clientReferenceCode: null,
      }),
    ).toEqual({
      primary: PENDING_CLIENT_REFERENCE_LABEL,
      secondary: null,
      pseudonymous: true,
    });
  });
});
