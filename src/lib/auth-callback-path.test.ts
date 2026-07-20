import { describe, expect, it } from "vitest";

import {
  defaultPostSignInPathForRole,
  isPostSignInPathAllowedForRole,
  resolvePostSignInPath,
  safeAfterSignInPath,
  stripSpuriousCallbackQuery,
} from "@/lib/auth-callback-path";

describe("stripSpuriousCallbackQuery", () => {
  it("removes error=unauthorized while keeping other params", () => {
    expect(stripSpuriousCallbackQuery("/advisor?error=unauthorized")).toBe(
      "/advisor",
    );
    expect(
      stripSpuriousCallbackQuery("/advisor?error=unauthorized&foo=bar"),
    ).toBe("/advisor?foo=bar");
    expect(stripSpuriousCallbackQuery("/advisor?foo=bar")).toBe(
      "/advisor?foo=bar",
    );
  });
});

describe("resolvePostSignInPath", () => {
  it("uses role defaults when callback is missing", () => {
    expect(resolvePostSignInPath(null, "ADVISOR")).toBe("/advisor");
    expect(resolvePostSignInPath(null, "ADMIN")).toBe("/admin");
    expect(resolvePostSignInPath(null, "USER")).toBe("/dashboard");
  });

  it("does not send advisors to platform admin after sign-in", () => {
    expect(resolvePostSignInPath("/admin", "ADVISOR")).toBe("/advisor");
    expect(resolvePostSignInPath("/admin/leads", "ADVISOR")).toBe("/advisor");
  });

  it("honors advisor callbacks and strips stale unauthorized notices", () => {
    expect(resolvePostSignInPath("/advisor/pipeline", "ADVISOR")).toBe(
      "/advisor/pipeline",
    );
    expect(
      resolvePostSignInPath("/advisor?error=unauthorized", "ADVISOR"),
    ).toBe("/advisor");
  });

  it("allows platform admins to return to admin destinations", () => {
    expect(resolvePostSignInPath("/admin/leads", "ADMIN")).toBe("/admin/leads");
    expect(resolvePostSignInPath("/admin", "SUPER_ADMIN")).toBe("/admin");
  });

  it("sends platform admins to admin home despite sticky advisor callbacks", () => {
    expect(resolvePostSignInPath("/advisor", "SUPER_ADMIN")).toBe("/admin");
    expect(resolvePostSignInPath("/advisor/pipeline", "ADMIN")).toBe("/admin");
    expect(
      resolvePostSignInPath("/advisor/pipeline?awaitingReview=1", "SUPER_ADMIN"),
    ).toBe("/admin");
  });

  it("still allows platform admins through neutral auth utility callbacks", () => {
    expect(resolvePostSignInPath("/mfa/verify", "SUPER_ADMIN")).toBe(
      "/mfa/verify",
    );
    expect(resolvePostSignInPath("/change-password", "ADMIN")).toBe(
      "/change-password",
    );
  });

  it("blocks clients from staff workspaces", () => {
    expect(resolvePostSignInPath("/advisor", "USER")).toBe("/dashboard");
    expect(resolvePostSignInPath("/admin", "USER")).toBe("/dashboard");
  });
});

describe("isPostSignInPathAllowedForRole", () => {
  it("allows neutral auth utility paths for any role", () => {
    expect(isPostSignInPathAllowedForRole("/change-password", "ADVISOR")).toBe(
      true,
    );
    expect(
      isPostSignInPathAllowedForRole(
        "/enterprise/join?token=abc",
        "ADVISOR",
      ),
    ).toBe(true);
  });
});

describe("defaultPostSignInPathForRole", () => {
  it("maps roles to workspace homes", () => {
    expect(defaultPostSignInPathForRole("advisor")).toBe("/advisor");
    expect(defaultPostSignInPathForRole("SUPER_ADMIN")).toBe("/admin");
  });
});

describe("safeAfterSignInPath", () => {
  it("strips unauthorized notice params", () => {
    expect(safeAfterSignInPath("/advisor?error=unauthorized")).toBe("/advisor");
  });
});
