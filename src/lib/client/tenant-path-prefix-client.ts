/**
 * Client-safe tenant path-prefix helpers (no server-only imports).
 *
 * In path-portal mode the proxy rewrites `/t/{slug}/signin` to `/signin` but the
 * browser URL keeps the `/t/{slug}` prefix (a rewrite, not a redirect). Post-auth
 * redirects therefore need to re-apply that prefix so the user stays inside the
 * tenant portal instead of landing on the bare platform host.
 *
 * Off-portal (platform/subdomain hosts) there is no `/t/{slug}` segment, so every
 * function here is a no-op — subdomain-mode tenancy rides on the Host header,
 * which hard navigations preserve automatically.
 */

/** Extract a leading `/t/{slug}` tenant prefix from a pathname, or null. */
export function extractTenantPathPrefix(pathname: string): string | null {
  const match = pathname.match(/^(\/t\/[^/]+)(?=\/|$)/);
  return match ? match[1] : null;
}

/** Strip a leading `/t/{slug}` segment so workspace guards see app-level paths. */
export function stripTenantPathPrefix(pathname: string): string {
  const prefix = extractTenantPathPrefix(pathname);
  if (!prefix) return pathname;
  const rest = pathname.slice(prefix.length);
  if (!rest || rest === "") return "/";
  return rest.startsWith("/") ? rest : `/${rest}`;
}

/**
 * Prefix a same-origin app path with a tenant prefix. No-op when prefix is null
 * or when the path is already tenant-scoped (avoids `/t/slug/t/slug/...`).
 */
export function scopePathToTenantPrefix(
  appPath: string,
  prefix: string | null,
): string {
  const normalized = appPath.startsWith("/") ? appPath : `/${appPath}`;
  if (!prefix) return normalized;
  if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
    return normalized;
  }
  const base = prefix.replace(/\/$/, "");
  if (normalized === "/") return base;
  return `${base}${normalized}`;
}

/** Re-apply the tenant prefix found in `pathname` to a destination app path. */
export function scopePathToCurrentTenant(
  appPath: string,
  pathname: string,
): string {
  return scopePathToTenantPrefix(appPath, extractTenantPathPrefix(pathname));
}

/**
 * Browser-bound convenience: scopes `appPath` using `window.location.pathname`.
 * Safe to call during SSR (returns the path unchanged when `window` is absent).
 */
export function scopePostAuthPath(appPath: string): string {
  if (typeof window === "undefined") return appPath;
  return scopePathToCurrentTenant(appPath, window.location.pathname);
}
