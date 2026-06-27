import { redirect } from "next/navigation";
import { buildSignInHref } from "@/lib/auth/sign-in-routes";

type MagicLinkRedirectPageProps = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

/**
 * Legacy client sign-in URL — forwards to the unified hub with the client tab selected.
 */
export default async function MagicLinkRedirectPage({
  searchParams,
}: MagicLinkRedirectPageProps) {
  const params = await searchParams;
  redirect(
    buildSignInHref({
      role: "client",
      callbackUrl: params.callbackUrl ?? null,
    })
  );
}
