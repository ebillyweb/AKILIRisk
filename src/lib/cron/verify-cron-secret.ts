import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

export function verifyCronSecretRequest(
  authHeader: string | null,
): NextResponse | null {
  const expectedSecret = process.env.CRON_SECRET?.trim();

  if (!expectedSecret) {
    console.error("CRON_SECRET environment variable is not configured");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing or invalid authorization header" },
      { status: 401 },
    );
  }

  const providedSecret = authHeader.substring(7);
  const providedBuf = Buffer.from(providedSecret, "utf8");
  const expectedBuf = Buffer.from(expectedSecret, "utf8");
  if (
    providedBuf.length !== expectedBuf.length ||
    !timingSafeEqual(providedBuf, expectedBuf)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
