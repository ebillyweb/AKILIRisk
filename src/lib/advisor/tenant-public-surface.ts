import { TENANT_PUBLIC_PREFIXES } from "@/lib/advisor/tenant-pass-through-paths";

/**
 * Tenant host paths that are public/auth/marketing (not signed-in workspace).
 * Theme: all active tenant hosts force light mode — see proxy `x-tenant-force-light`.
 */
export function isTenantPublicSurfacePath(pathname: string): boolean {
  if (pathname === "/") return true;
  return TENANT_PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
