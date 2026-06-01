import { describe, expect, it } from "vitest";
import { isTenantPassThroughPath } from "./tenant-pass-through-paths";

describe("isTenantPassThroughPath", () => {
  it("passes client workspace routes through on tenant hosts", () => {
    expect(isTenantPassThroughPath("/profiles")).toBe(true);
    expect(isTenantPassThroughPath("/documents")).toBe(true);
    expect(isTenantPassThroughPath("/intake/complete")).toBe(true);
    expect(isTenantPassThroughPath("/dashboard")).toBe(true);
  });

  it("does not pass unknown app paths through to branded rewrites", () => {
    expect(isTenantPassThroughPath("/")).toBe(false);
    expect(isTenantPassThroughPath("/branded/client-portal")).toBe(false);
  });
});
