import { signOut } from "next-auth/react";

export type ClientSignOutOptions = {
  /** Explicit post-sign-out destination. */
  redirectTo?: string;
  /** Current page path when no explicit destination is provided. */
  pathname?: string;
};

/** Resolve where Auth.js should send the browser after sign-out. */
export function resolveSignOutRedirectTo(
  options: ClientSignOutOptions = {},
): string {
  return options.redirectTo ?? options.pathname ?? "/";
}

/**
 * Client sign-out that uses Auth.js redirect navigation (full reload).
 * Avoid `redirect: false` + `router.refresh()` — SessionProvider can keep a
 * stale authenticated shell and leave header CTAs unchanged.
 */
export async function performClientSignOut(
  options: ClientSignOutOptions = {},
): Promise<void> {
  const redirectTo = resolveSignOutRedirectTo(options);
  await signOut({ redirectTo });
}
