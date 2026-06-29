import { describe, expect, it } from "vitest";
import { isTenantPassThroughPath } from "./tenant-pass-through-paths";

describe("isTenantPassThroughPath", () => {
  it("passes client workspace routes through on tenant hosts", () => {
    expect(isTenantPassThroughPath("/profiles")).toBe(true);
    expect(isTenantPassThroughPath("/documents")).toBe(true);
    expect(isTenantPassThroughPath("/intake/complete")).toBe(true);
    expect(isTenantPassThroughPath("/dashboard")).toBe(true);
  });

  it("passes auth flow routes through so proxy redirects resolve on tenant portals", () => {
    // The proxy redirects MFA/password-pending users to these paths and
    // tenant-scopes them (`/t/{slug}/...`); they must pass through, not
    // rewrite to `/branded/*`.
    expect(isTenantPassThroughPath("/signin")).toBe(true);
    expect(isTenantPassThroughPath("/mfa/verify")).toBe(true);
    expect(isTenantPassThroughPath("/change-password")).toBe(true);
  });

  it("does not pass unknown app paths through to branded rewrites", () => {
    expect(isTenantPassThroughPath("/")).toBe(false);
    expect(isTenantPassThroughPath("/branded/client-portal")).toBe(false);
  });
});
