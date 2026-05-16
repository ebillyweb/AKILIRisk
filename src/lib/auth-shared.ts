/**
 * Auth helpers shared between the Node-runtime callbacks (`auth.ts`) and
 * the Edge-runtime callbacks (`auth-edge.ts`).
 *
 * Pure functions only — no Prisma, no `node:crypto`, no `node:fs`. Anything
 * here must run inside Vercel's Edge runtime where the proxy/middleware
 * lives.
 */

/** Primary dev / ops account email (see seed scripts and local docs). */
export const DESIGNATED_ADMIN_EMAIL = "buddy@ebilly.com";

/** True iff the email exactly matches the designated admin account. */
export function isDesignatedAdminEmail(
  email: string | null | undefined
): boolean {
  return email === DESIGNATED_ADMIN_EMAIL;
}
