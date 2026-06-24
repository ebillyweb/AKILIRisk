import { TENANT_PUBLIC_PREFIXES } from "@/lib/advisor/tenant-pass-through-paths";

/**
 * Tenant host paths that should always render in light mode (landing + public auth).
 * Workspace routes (/dashboard, /intake, …) are excluded — user theme choice applies there.
 */
export function isTenantPublicSurfacePath(pathname: string): boolean {
  if (pathname === "/") return true;
  return TENANT_PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
