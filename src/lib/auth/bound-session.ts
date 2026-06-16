import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

/**
 * Read the DB session token bound to the caller's JWT (set in the auth `jwt`
 * callback). Used by MFA verification routes so they update the SAME session
 * row the JWT reads when deciding whether to challenge — eliminating the
 * "newest arbitrary row" drift that caused spurious TOTP prompts.
 *
 * Returns null if there is no token or no bound sessionToken.
 */
export async function getBoundSessionToken(
  req: NextRequest
): Promise<string | null> {
  const proto = req.headers.get("x-forwarded-proto");
  const secureCookie = proto === "https" || req.nextUrl.protocol === "https:";
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    secureCookie,
  });
  const sessionToken = (token as { sessionToken?: unknown } | null)
    ?.sessionToken;
  return typeof sessionToken === "string" ? sessionToken : null;
}
