import { describe, expect, it } from "vitest";

import {
  clampBrandingPolicyToModuleTier,
  mapEnterpriseMemberBrandingPolicy,
} from "./enterprise-member-branding-policy-tier";

describe("mapEnterpriseMemberBrandingPolicy", () => {
  it("maps database columns to policy keys", () => {
    expect(
      mapEnterpriseMemberBrandingPolicy({
        advisorMemberPersonalBrandingEnabled: true,
        advisorMemberSubdomainEditable: false,
      }),
    ).toEqual({
      personalBranding: true,
      personalSubdomain: false,
    });
  });
});

describe("clampBrandingPolicyToModuleTier", () => {
  it("clears subdomain when personal branding is off", () => {
    expect(
      clampBrandingPolicyToModuleTier(
        { personalBranding: false, personalSubdomain: true },
        "PROFESSIONAL",
      ),
    ).toEqual({
      personalBranding: false,
      personalSubdomain: false,
    });
  });

  it("allows both on professional tier", () => {
    expect(
      clampBrandingPolicyToModuleTier(
        { personalBranding: true, personalSubdomain: true },
        "PROFESSIONAL",
      ),
    ).toEqual({
      personalBranding: true,
      personalSubdomain: true,
    });
  });

  it("clamps personal branding on essentials", () => {
    expect(
      clampBrandingPolicyToModuleTier(
        { personalBranding: true, personalSubdomain: true },
        "ESSENTIALS",
      ),
    ).toEqual({
      personalBranding: false,
      personalSubdomain: false,
    });
  });
});
