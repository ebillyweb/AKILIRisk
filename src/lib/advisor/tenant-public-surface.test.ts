import { describe, expect, it } from "vitest";
import { isTenantPublicSurfacePath } from "./tenant-public-surface";

describe("isTenantPublicSurfacePath", () => {
  it("includes tenant landing and public auth routes", () => {
    expect(isTenantPublicSurfacePath("/")).toBe(true);
    expect(isTenantPublicSurfacePath("/signin/magic-link")).toBe(true);
    expect(isTenantPublicSurfacePath("/start")).toBe(true);
    expect(isTenantPublicSurfacePath("/signup")).toBe(true);
  });

  it("excludes signed-in workspace routes", () => {
    expect(isTenantPublicSurfacePath("/dashboard")).toBe(false);
    expect(isTenantPublicSurfacePath("/intake")).toBe(false);
    expect(isTenantPublicSurfacePath("/assessment")).toBe(false);
  });
});
