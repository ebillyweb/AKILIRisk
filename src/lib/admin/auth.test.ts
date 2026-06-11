import { describe, it, expect } from "vitest";
import type { Session } from "next-auth";

import {
  isPlatformAdminRole,
  isSuperAdminRole,
} from "@/lib/auth-roles";

function sessionFor(
  role: string,
  email = "anyone@example.com"
): Session {
  return {
    user: {
      id: "user-1",
      email,
      role,
    },
    expires: new Date(Date.now() + 60_000).toISOString(),
  };
}

function isAdmin(session: Session | null): boolean {
  return isPlatformAdminRole(session?.user?.role);
}

function isSuperAdmin(session: Session | null): boolean {
  return isSuperAdminRole(session?.user?.role);
}

function isAdminUser(
  _email: string | null | undefined,
  role: string | null | undefined
): boolean {
  return isPlatformAdminRole(role);
}

describe("platform admin authorization (SEC-4)", () => {
  it("grants admin access based on ADMIN role, not a hardcoded email", () => {
    const platformAdmin = sessionFor("ADMIN", "platform-admin@test.com");
    expect(isAdmin(platformAdmin)).toBe(true);
    expect(isAdminUser(platformAdmin.user.email, platformAdmin.user.role)).toBe(
      true
    );
  });

  it("allows multiple distinct admin accounts", () => {
    const superAdmin = sessionFor("SUPER_ADMIN", "ops-lead@example.com");
    const staffAdmin = sessionFor("ADMIN", "platform-admin@test.com");

    expect(isAdmin(superAdmin)).toBe(true);
    expect(isAdmin(staffAdmin)).toBe(true);
    expect(isSuperAdmin(superAdmin)).toBe(true);
    expect(isSuperAdmin(staffAdmin)).toBe(false);
  });

  it("does not treat USER role as admin regardless of email", () => {
    const client = sessionFor("USER", "buddy@ebilly.com");
    expect(isPlatformAdminRole(client.user.role)).toBe(false);
    expect(isAdmin(client)).toBe(false);
  });

  it("does not allow self-escalation via email alone", () => {
    const wouldBeAdminByEmailOnly = sessionFor("USER", "platform-admin@test.com");
    expect(isAdmin(wouldBeAdminByEmailOnly)).toBe(false);
    expect(isAdminUser(wouldBeAdminByEmailOnly.user.email, "USER")).toBe(false);
  });
});
