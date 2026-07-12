import { describe, expect, it } from "vitest";
import { resolvePostMfaSetupRedirect } from "@/lib/auth/mfa-setup-redirect";

describe("resolvePostMfaSetupRedirect", () => {
  it("sends unverified users to MFA verify with callback", () => {
    expect(
      resolvePostMfaSetupRedirect({
        role: "USER",
        mfaVerified: false,
        callbackUrl: "/dashboard",
      })
    ).toBe("/mfa/verify?callbackUrl=%2Fdashboard");
  });

  it("never returns /settings", () => {
    const paths = [
      resolvePostMfaSetupRedirect({ role: "USER", mfaVerified: true }),
      resolvePostMfaSetupRedirect({ role: "ADVISOR", mfaVerified: true }),
      resolvePostMfaSetupRedirect({ role: "ADMIN", mfaVerified: true }),
      resolvePostMfaSetupRedirect({
        role: "USER",
        mfaVerified: false,
        callbackUrl: "/settings",
      }),
    ];
    for (const path of paths) {
      expect(path).not.toContain("/settings");
    }
  });

  it("routes staff to role home when verified", () => {
    expect(
      resolvePostMfaSetupRedirect({ role: "ADVISOR", mfaVerified: true })
    ).toBe("/advisor");
    expect(
      resolvePostMfaSetupRedirect({ role: "ADMIN", mfaVerified: true })
    ).toBe("/admin");
  });

  it("uses callbackUrl for verified clients when safe", () => {
    expect(
      resolvePostMfaSetupRedirect({
        role: "USER",
        mfaVerified: true,
        callbackUrl: "/assessment",
      })
    ).toBe("/assessment");
  });

  it("does not send advisors to platform admin after MFA setup", () => {
    expect(
      resolvePostMfaSetupRedirect({
        role: "ADVISOR",
        mfaVerified: true,
        callbackUrl: "/admin",
      })
    ).toBe("/advisor");
  });
});
