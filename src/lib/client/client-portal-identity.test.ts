import { describe, expect, it } from "vitest";

import { resolveClientPortalSignedInLabel } from "@/lib/client/client-portal-identity";

describe("resolveClientPortalSignedInLabel", () => {
  it("shows email when pseudonymous labeling is disabled", () => {
    expect(
      resolveClientPortalSignedInLabel({
        clientEmail: "client@test.com",
        pseudonymousWorkspaceLabeling: false,
        clientReferenceCode: "CL-8F3K-29QX",
      }),
    ).toBe("client@test.com");
  });

  it("shows Client CL-… when pseudonymous labeling is enabled", () => {
    expect(
      resolveClientPortalSignedInLabel({
        clientEmail: "client@test.com",
        pseudonymousWorkspaceLabeling: true,
        clientReferenceCode: "CL-8F3K-29QX",
      }),
    ).toBe("Client CL-8F3K-29QX");
  });

  it("falls back to email when labeling is on but reference is missing", () => {
    expect(
      resolveClientPortalSignedInLabel({
        clientEmail: "client@test.com",
        pseudonymousWorkspaceLabeling: true,
        clientReferenceCode: null,
      }),
    ).toBe("client@test.com");
  });
});
