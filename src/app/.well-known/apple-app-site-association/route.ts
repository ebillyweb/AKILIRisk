import { NextResponse } from "next/server";

export const dynamic = "force-static";

/**
 * Apple App Site Association — lets iOS open `https://<host>/auth/*` links
 * directly in the app (magic-link sign-in, plan §7).
 *
 * Served at `/.well-known/apple-app-site-association` with a JSON content type
 * and no redirect, as Apple requires. The app identifier is `TEAMID.bundleId`;
 * set APPLE_APP_ID (or APPLE_TEAM_ID) once the Apple Developer account is
 * provisioned (plan §13 open item).
 */
export function GET() {
  const appId =
    process.env.APPLE_APP_ID?.trim() ||
    `${process.env.APPLE_TEAM_ID?.trim() || "TEAMID"}.com.ebilly.akilirisk`;

  const body = {
    applinks: {
      apps: [],
      details: [
        {
          appIDs: [appId],
          components: [{ "/": "/auth/*", comment: "Magic-link sign-in" }],
        },
      ],
    },
  };

  return NextResponse.json(body, {
    headers: { "content-type": "application/json" },
  });
}
