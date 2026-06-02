"use server";

import { validateInviteCode, createInviteToken } from "@/lib/invite";
import { getPublicAppUrlStrict } from "@/lib/public-app-url";

export async function submitInviteCode(
  code: string
): Promise<{ redirectUrl?: string; error?: string }> {
  const result = await validateInviteCode(code);
  if ("error" in result) return { error: result.error };
  const base = getPublicAppUrlStrict();
  if (!base) {
    return { error: "App URL is not configured (AUTH_URL / NEXT_PUBLIC_URL)." };
  }
  const token = createInviteToken(result.id);
  const params = new URLSearchParams({ invite: token, callbackUrl: "/intake" });
  return { redirectUrl: `${base}/signup?${params.toString()}` };
}
