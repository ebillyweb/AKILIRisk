import { matchesPathPrefix } from "@/lib/auth/mfa-gate";

/** Email + password — advisor and platform admin accounts only. */
export const STAFF_CREDENTIALS_SIGN_IN_PATH = "/signin";

/** Magic-link request — client (USER role) accounts only. */
export const CLIENT_MAGIC_LINK_SIGN_IN_PATH = "/signin/magic-link";

const STAFF_WORKSPACE_PREFIXES = ["/admin", "/advisor"] as const;

const CLIENT_WORKSPACE_PREFIXES = [
  "/dashboard",
  "/assessment",
  "/intake",
  "/settings",
  "/consent",
  "/profiles",
  "/documents",
  "/family",
] as const;

export function isStaffWorkspacePath(pathname: string): boolean {
  return STAFF_WORKSPACE_PREFIXES.some((prefix) =>
    matchesPathPrefix(pathname, prefix)
  );
}

export function isClientWorkspacePath(pathname: string): boolean {
  return CLIENT_WORKSPACE_PREFIXES.some((prefix) =>
    matchesPathPrefix(pathname, prefix)
  );
}

/**
 * Credentials sign-in path for a protected destination. Client workspaces
 * route to the magic-link flow instead of `/signin`.
 */
export function getSignInPathForWorkspace(pathname: string): string {
  const pathOnly = pathname.split("?")[0] ?? pathname;

  if (isClientWorkspacePath(pathOnly)) {
    return CLIENT_MAGIC_LINK_SIGN_IN_PATH;
  }

  if (pathOnly.startsWith("/advisor")) {
    return `${STAFF_CREDENTIALS_SIGN_IN_PATH}?portal=advisor`;
  }

  if (isStaffWorkspacePath(pathOnly)) {
    return STAFF_CREDENTIALS_SIGN_IN_PATH;
  }

  return CLIENT_MAGIC_LINK_SIGN_IN_PATH;
}

export function shouldRedirectCredentialsSignInToMagicLink(
  callbackUrl: string | null | undefined
): boolean {
  if (!callbackUrl) return false;
  const pathOnly = callbackUrl.split("?")[0] ?? "";
  return isClientWorkspacePath(pathOnly);
}

export function buildSignInHref(options: {
  callbackUrl?: string | null;
  /** Force staff credentials or client magic-link instead of inferring from callback. */
  audience?: "staff" | "client";
}): string {
  const { callbackUrl, audience } = options;

  let path =
    audience === "client"
      ? CLIENT_MAGIC_LINK_SIGN_IN_PATH
      : audience === "staff"
        ? STAFF_CREDENTIALS_SIGN_IN_PATH
        : callbackUrl
          ? getSignInPathForWorkspace(callbackUrl)
          : STAFF_CREDENTIALS_SIGN_IN_PATH;

  if (
    audience === "staff" &&
    callbackUrl?.split("?")[0]?.startsWith("/advisor")
  ) {
    path = `${STAFF_CREDENTIALS_SIGN_IN_PATH}?portal=advisor`;
  }

  if (!callbackUrl || !callbackUrl.startsWith("/") || callbackUrl.startsWith("//")) {
    return path;
  }

  const url = new URL(path, "http://local");
  url.searchParams.set("callbackUrl", callbackUrl);
  return `${url.pathname}${url.search}`;
}
