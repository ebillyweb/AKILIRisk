/**
 * Best-effort client IP extraction for rate-limit and audit-log keys.
 *
 * Behind a trusted edge proxy (Vercel, Cloudflare, ALB) the real client IP
 * lives in `x-forwarded-for`, with `x-real-ip` as a fallback some proxies
 * use. Direct connections expose neither, in which case we return null and
 * let the caller decide on a default. We never trust these headers for
 * security decisions — they are spoofable from anything not behind our
 * edge — but they're fine for rate-limit bucketing.
 *
 * `x-forwarded-for` is a comma-separated list (`client, proxy1, proxy2`).
 * The leftmost entry is the original client per RFC 7239.
 */
export function clientIpFromRequest(
  req: Request | { headers: Headers }
): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) {
    const trimmed = real.trim();
    if (trimmed) return trimmed;
  }
  return null;
}
