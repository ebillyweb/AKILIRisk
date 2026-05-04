/**
 * Truncate a client IP to a privacy-respecting form for audit-log storage.
 *
 * - IPv4 (`a.b.c.d`): zero the last octet. `192.168.1.45` → `192.168.1.0`.
 * - IPv6: keep the first 4 hextets, zero the rest. `2001:db8:abcd:0012:...` → `2001:db8:abcd:12::0`.
 * - Anything we can't parse: return null. Better to drop than to log a string
 *   we don't understand and accidentally retain a full PII-grade IP.
 *
 * Background: the audit log is a long-lived datastore that admins can browse
 * and export. Storing full client IPs would re-introduce the kind of PII
 * concern BRD §5.1 warns about. Last-octet zeroing keeps rough geo-locality
 * for forensics ("attack came from 192.168.1.0/24") without storing the
 * specific endpoint.
 */
export function truncateIpForAudit(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // x-forwarded-for sometimes carries `ip:port` for IPv4 from certain edges;
  // strip a trailing :NNNN before parsing.
  const stripped = raw.trim().replace(/:\d+$/, (m) => {
    // Only strip if the rest is plain IPv4 (not an IPv6 segment).
    return /^\d+\.\d+\.\d+\.\d+:\d+$/.test(raw.trim()) ? "" : m;
  });

  // IPv4
  const v4 = stripped.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/);
  if (v4) {
    const [_, a, b, c] = v4;
    if ([a, b, c].every((s) => Number(s) >= 0 && Number(s) <= 255)) {
      return `${a}.${b}.${c}.0`;
    }
    return null;
  }

  // IPv6 — best-effort. We don't fully parse IPv6 (`::` zero-run expansion is
  // surprisingly fiddly); we keep the first 4 colon-separated hextets and
  // append `::0`. This loses precision compared to a true /64 truncate but is
  // safer than returning the unmodified value.
  if (stripped.includes(":")) {
    const parts = stripped.split(":").filter(Boolean);
    if (parts.length === 0) return null;
    // Validate each kept hextet is hex.
    const kept = parts.slice(0, 4);
    if (!kept.every((h) => /^[0-9a-fA-F]{1,4}$/.test(h))) return null;
    return `${kept.join(":")}::0`;
  }

  return null;
}
