/**
 * Auth helpers shared between the Node-runtime callbacks (`auth.ts`) and
 * the Edge-runtime callbacks (`auth-edge.ts`).
 *
 * Pure functions only — no Prisma, no `node:crypto`, no `node:fs`. Anything
 * here must run inside Vercel's Edge runtime where the proxy/middleware
 * lives.
 */

/** Email of the only account permitted to hold the ADMIN role today.
 *  Same string lived inline in both auth.ts and auth-edge.ts before this
 *  helper existed; keep it in sync if you ever change it. */
const DESIGNATED_ADMIN_EMAIL = "buddy@ebilly.com";

/**
 * Demote ADMIN → USER unless the session belongs to the designated admin
 * account. Identical guard runs in both session callbacks so middleware
 * (auth-edge) and page handlers (auth) see the same effective role for any
 * given JWT.
 *
 * Without this guard, a user with `role=ADMIN` in the DB but a different
 * email gets ADMIN treatment in middleware while page handlers demote
 * them to USER — an inconsistency that's surprising at best and exploit-
 * adjacent at worst.
 */
export function applyAdminDemotion(
  rawRole: string | null | undefined,
  email: string | null | undefined
): string {
  const role = (rawRole ?? "USER").toString();
  if (role === "ADMIN" && email !== DESIGNATED_ADMIN_EMAIL) {
    return "USER";
  }
  return role;
}
