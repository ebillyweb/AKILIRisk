import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
}));

import { signOut } from "next-auth/react";

import {
  performClientSignOut,
  resolveSignOutRedirectTo,
} from "@/lib/auth/client-sign-out";

describe("resolveSignOutRedirectTo", () => {
  it("prefers an explicit redirectTo", () => {
    expect(
      resolveSignOutRedirectTo({ redirectTo: "/pricing", pathname: "/" }),
    ).toBe("/pricing");
  });

  it("falls back to pathname", () => {
    expect(resolveSignOutRedirectTo({ pathname: "/firms" })).toBe("/firms");
  });

  it("defaults to home", () => {
    expect(resolveSignOutRedirectTo()).toBe("/");
  });
});

describe("performClientSignOut", () => {
  beforeEach(() => {
    vi.mocked(signOut).mockReset();
    vi.mocked(signOut).mockResolvedValue(undefined);
  });

  it("uses Auth.js redirect navigation instead of a soft refresh", async () => {
    await performClientSignOut({ pathname: "/" });

    expect(signOut).toHaveBeenCalledOnce();
    expect(signOut).toHaveBeenCalledWith({ redirectTo: "/" });
    expect(signOut).not.toHaveBeenCalledWith(
      expect.objectContaining({ redirect: false }),
    );
  });

  it("honors an explicit redirectTo override", async () => {
    await performClientSignOut({ redirectTo: "/advisor", pathname: "/" });

    expect(signOut).toHaveBeenCalledWith({ redirectTo: "/advisor" });
  });
});
