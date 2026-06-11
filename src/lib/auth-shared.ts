/**
 * Auth helpers shared between the Node-runtime callbacks (`auth.ts`) and
 * the Edge-runtime callbacks (`auth-edge.ts`).
 *
 * Pure functions only — no Prisma, no `node:crypto`, no `node:fs`. Anything
 * here must run inside Vercel's Edge runtime where the proxy/middleware
 * lives.
 */

/** Primary dev / ops account email for seeds and contact-form default — not used for authorization. */
export const DESIGNATED_ADMIN_EMAIL = "buddy@ebilly.com";

/** @deprecated Not used for admin authorization; retained for contact-form default only. */
export function isDesignatedAdminEmail(
  email: string | null | undefined
): boolean {
  return email === DESIGNATED_ADMIN_EMAIL;
}
