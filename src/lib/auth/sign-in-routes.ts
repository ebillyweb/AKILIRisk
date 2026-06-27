import { matchesPathPrefix } from "@/lib/auth/mfa-gate";
import { isSignInRole, type SignInRole } from "@/lib/auth/sign-in-roles";

/** Unified sign-in hub for all roles. */
export const SIGN_IN_HUB_PATH = "/signin";

/** Email + password — advisor and platform admin accounts only. */
export const STAFF_CREDENTIALS_SIGN_IN_PATH = SIGN_IN_HUB_PATH;

/**
 * Legacy client magic-link path — redirects to the hub with `role=client`.
 * Kept so existing bookmarks and deep links keep working.
 */
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

function roleForWorkspace(pathname: string): SignInRole {
  const pathOnly = pathname.split("?")[0] ?? pathname;

  if (isClientWorkspacePath(pathOnly)) {
    return "client";
  }

  if (pathOnly.startsWith("/advisor")) {
    return "advisor";
  }

  if (isStaffWorkspacePath(pathOnly)) {
    return "admin";
  }

  return "client";
}

/**
 * Sign-in path for a protected destination, including the appropriate role tab.
 */
export function getSignInPathForWorkspace(pathname: string): string {
  return buildSignInHref({ callbackUrl: pathname });
}

export function shouldRedirectCredentialsSignInToMagicLink(
  callbackUrl: string | null | undefined
): boolean {
  if (!callbackUrl) return false;
  const pathOnly = callbackUrl.split("?")[0] ?? "";
  return isClientWorkspacePath(pathOnly);
}

/**
 * Post-magic-link sign-in destination. Open-redirect safe: same-origin
 * relative paths only, and must land in a client workspace.
 */
export function sanitizeMagicLinkRedirectTo(
  raw: string | null | undefined,
  fallback = "/dashboard"
): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return fallback;
  }
  const pathOnly = raw.split("?")[0] ?? raw;
  if (!isClientWorkspacePath(pathOnly)) {
    return fallback;
  }
  return raw;
}

export function buildSignInHref(options: {
  callbackUrl?: string | null;
  /** Force staff credentials or client magic-link instead of inferring from callback. */
  audience?: "staff" | "client";
  /** Explicit hub tab selection. */
  role?: SignInRole;
}): string {
  const { callbackUrl, audience, role: explicitRole } = options;

  let role: SignInRole;
  if (explicitRole) {
    role = explicitRole;
  } else if (audience === "client") {
    role = "client";
  } else if (audience === "staff") {
    role = callbackUrl ? roleForWorkspace(callbackUrl) : "advisor";
    if (role === "client") {
      role = "advisor";
    }
  } else if (callbackUrl) {
    role = roleForWorkspace(callbackUrl);
  } else {
    role = "client";
  }

  const url = new URL(SIGN_IN_HUB_PATH, "http://local");
  url.searchParams.set("role", role);

  if (callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")) {
    url.searchParams.set("callbackUrl", callbackUrl);
  }

  return `${url.pathname}${url.search}`;
}

/**
 * Resolves the active sign-in role from URL params and optional callback context.
 * Supports legacy `portal=advisor` and infers role from protected destinations.
 */
export function resolveSignInRole(options: {
  role?: string | null;
  portal?: string | null;
  callbackUrl?: string | null;
  fallback?: SignInRole;
}): SignInRole {
  const { role, portal, callbackUrl, fallback = "client" } = options;

  if (isSignInRole(role)) {
    return role;
  }

  if (portal === "advisor") {
    return "advisor";
  }

  if (callbackUrl) {
    const pathOnly = callbackUrl.split("?")[0] ?? callbackUrl;
    if (isClientWorkspacePath(pathOnly)) {
      return "client";
    }
    if (pathOnly.startsWith("/advisor")) {
      return "advisor";
    }
    if (isStaffWorkspacePath(pathOnly) && pathOnly.startsWith("/admin")) {
      return "admin";
    }
  }

  return fallback;
}
