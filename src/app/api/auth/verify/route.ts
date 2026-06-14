import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { consumeCode, consumeLinkToken } from "@/lib/mobile/magic-link";
import { createMobileToken, projectUserByEmail } from "@/lib/mobile/token";

const schema = z.union([
  z.object({ token: z.string().min(1) }),
  z.object({ email: z.string().email(), code: z.string().length(6) }),
]);

/**
 * POST /api/auth/verify — exchanges a magic-link token or 6-digit code for a
 * mobile bearer token + the session user.
 */
export async function POST(request: NextRequest) {
  let body: z.infer<typeof schema>;
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Provide a token or an email and code." }, { status: 400 });
    }
    body = parsed.data;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email =
    "token" in body ? await consumeLinkToken(body.token) : await consumeCode(body.email, body.code);

  if (!email) {
    return NextResponse.json(
      { error: "This sign-in link or code is invalid or has expired." },
      { status: 401 },
    );
  }

  const user = await projectUserByEmail(email);
  if (!user) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  return NextResponse.json({ token: createMobileToken(user.id), user });
}
