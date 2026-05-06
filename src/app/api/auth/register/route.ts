import { NextResponse } from "next/server";

/**
 * Legacy password registration endpoint (pre–Round-11).
 *
 * Client accounts are created via advisor invitation + magic link; this
 * route returns **410 Gone** so cached clients get a clear message.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Client signup via password is no longer supported. Ask your advisor to send you a sign-in link.",
    },
    { status: 410 }
  );
}
