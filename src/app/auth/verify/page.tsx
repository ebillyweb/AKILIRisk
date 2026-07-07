import { VerifyRedirect } from "./verify-redirect";

export const metadata = {
  title: "Sign in to AkiliRisk",
};

/**
 * `/auth/verify` — target of the magic-link email. The path matches the
 * iOS AASA (`/auth/*`) and Android intent filter (`/auth` prefix) so installed
 * apps intercept it; this page is the browser fallback.
 */
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <VerifyRedirect token={token ?? null} />;
}
