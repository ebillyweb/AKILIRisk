"use server";

import { headers } from "next/headers";
import { validateInviteCode, createInviteToken } from "@/lib/invite";
import { buildTenantScopedPublicPath } from "@/lib/advisor/tenant-path-portals";
import { buildSignInHref } from "@/lib/auth/sign-in-routes";
import { resolvePublicAppUrl } from "@/lib/public-app-url";

export async function submitInviteCode(
  code: string
): Promise<{ redirectUrl?: string; error?: string }> {
  const result = await validateInviteCode(code);
  if ("error" in result) return { error: result.error };

  const tenantPathPrefix = (await headers()).get("x-tenant-path-prefix");
  const base = (await resolvePublicAppUrl()).replace(/\/$/, "");

  if ("signInEmail" in result) {
    const signInPath = buildSignInHref({
      role: "client",
      email: result.signInEmail,
    });
    return {
      redirectUrl: `${base}${buildTenantScopedPublicPath(signInPath, tenantPathPrefix)}`,
    };
  }

  const token = createInviteToken(result.id);
  const params = new URLSearchParams({ invite: token, callbackUrl: "/intake" });
  const signupPath = buildTenantScopedPublicPath(
    `/signup?${params.toString()}`,
    tenantPathPrefix,
  );
  return { redirectUrl: `${base}${signupPath}` };
}
