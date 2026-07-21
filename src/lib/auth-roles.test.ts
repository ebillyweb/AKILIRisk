import { describe, it, expect } from "vitest";

import {
  clientHomeRedirectTargetForRole,
  isAdvisorHubNavRole,
  isPlatformAdminRole,
  isSuperAdminRole,
  normalizeUserRoleString,
} from "./auth-roles";

describe("normalizeUserRoleString", () => {
  it("returns USER for null, undefined, and empty string", () => {
    expect(normalizeUserRoleString(null)).toBe("USER");
    expect(normalizeUserRoleString(undefined)).toBe("USER");
    expect(normalizeUserRoleString("")).toBe("USER");
  });

  it("normalizes known roles case-insensitively", () => {
    expect(normalizeUserRoleString("advisor")).toBe("ADVISOR");
    expect(normalizeUserRoleString("Admin")).toBe("ADMIN");
    expect(normalizeUserRoleString("super_admin")).toBe("SUPER_ADMIN");
    expect(normalizeUserRoleString("user")).toBe("USER");
  });

  it("maps unknown values to USER (US-49)", () => {
    expect(normalizeUserRoleString("GARBAGE")).toBe("USER");
    expect(normalizeUserRoleString("CLIENT")).toBe("USER");
    expect(normalizeUserRoleString("MODERATOR")).toBe("USER");
  });
});

describe("role helpers use normalization", () => {
  it("treats garbage role as non-admin and non-advisor-hub", () => {
    expect(isPlatformAdminRole("not-a-role")).toBe(false);
    expect(isAdvisorHubNavRole("not-a-role")).toBe(false);
    expect(isSuperAdminRole("not-a-role")).toBe(false);
  });

  it("accepts mixed-case canonical roles", () => {
    expect(isPlatformAdminRole("admin")).toBe(true);
    expect(isAdvisorHubNavRole("Advisor")).toBe(true);
    expect(isSuperAdminRole("Super_Admin")).toBe(true);
  });
});

describe("clientHomeRedirectTargetForRole", () => {
  it("keeps clients on the dashboard (null)", () => {
    expect(clientHomeRedirectTargetForRole("USER")).toBeNull();
    expect(clientHomeRedirectTargetForRole(null)).toBeNull();
    expect(clientHomeRedirectTargetForRole(undefined)).toBeNull();
    // Unknown roles normalize to USER, so they also stay (no open redirect).
    expect(clientHomeRedirectTargetForRole("GARBAGE")).toBeNull();
  });

  it("routes advisors to /advisor", () => {
    expect(clientHomeRedirectTargetForRole("ADVISOR")).toBe("/advisor");
    expect(clientHomeRedirectTargetForRole("advisor")).toBe("/advisor");
  });

  it("routes platform admins to /admin", () => {
    expect(clientHomeRedirectTargetForRole("ADMIN")).toBe("/admin");
    expect(clientHomeRedirectTargetForRole("SUPER_ADMIN")).toBe("/admin");
    expect(clientHomeRedirectTargetForRole("Super_Admin")).toBe("/admin");
  });
});
