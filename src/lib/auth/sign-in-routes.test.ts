import { describe, expect, it } from "vitest";
import {
  buildSignInHref,
  CLIENT_MAGIC_LINK_SIGN_IN_PATH,
  getSignInPathForWorkspace,
  sanitizeMagicLinkRedirectTo,
  shouldRedirectCredentialsSignInToMagicLink,
  STAFF_CREDENTIALS_SIGN_IN_PATH,
} from "@/lib/auth/sign-in-routes";

describe("sign-in routes", () => {
  it("routes client workspaces to magic link", () => {
    expect(getSignInPathForWorkspace("/dashboard")).toBe(
      CLIENT_MAGIC_LINK_SIGN_IN_PATH
    );
    expect(getSignInPathForWorkspace("/assessment/governance")).toBe(
      CLIENT_MAGIC_LINK_SIGN_IN_PATH
    );
  });

  it("routes advisor workspace to credentials with portal hint", () => {
    expect(getSignInPathForWorkspace("/advisor")).toBe(
      "/signin?portal=advisor"
    );
  });

  it("routes admin workspace to staff credentials", () => {
    expect(getSignInPathForWorkspace("/admin")).toBe(STAFF_CREDENTIALS_SIGN_IN_PATH);
  });

  it("builds href with callbackUrl", () => {
    expect(buildSignInHref({ callbackUrl: "/dashboard" })).toBe(
      "/signin/magic-link?callbackUrl=%2Fdashboard"
    );
    expect(buildSignInHref({ callbackUrl: "/advisor" })).toBe(
      "/signin?portal=advisor&callbackUrl=%2Fadvisor"
    );
  });

  it("detects client callbacks that should leave /signin", () => {
    expect(shouldRedirectCredentialsSignInToMagicLink("/intake")).toBe(true);
    expect(shouldRedirectCredentialsSignInToMagicLink("/admin")).toBe(false);
  });

  it("sanitizes magic-link redirect targets to client workspaces", () => {
    expect(sanitizeMagicLinkRedirectTo("/assessment")).toBe("/assessment");
    expect(sanitizeMagicLinkRedirectTo("//evil.example")).toBe("/dashboard");
    expect(sanitizeMagicLinkRedirectTo("/advisor")).toBe("/dashboard");
    expect(sanitizeMagicLinkRedirectTo(null, "/assessment")).toBe("/assessment");
  });
});
