import Link from "next/link";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";
import { validateMagicLinkToken } from "@/lib/auth/magic-link";

/**
 * Round-11 commit 2 (BRD §5.1.AUTH): magic-link click handler.
 *
 * Flow:
 *   1. Read `?token=...` from the URL.
 *   2. Validate the token (non-mutating). Reject with a 410-ish page on
 *      missing / expired / used / inactive.
 *   3. On success: call signIn("magic-link", { token, redirect: false }).
 *      The provider in auth.config.ts re-validates + atomically consumes
 *      and returns the User. NextAuth issues a JWT session cookie.
 *   4. Redirect to /dashboard.
 *
 * Two-phase validate (here + in the provider) is deliberate: the page-level
 * validate gives us a friendly UI on the failure path WITHOUT consuming the
 * token (so the user can request a fresh one or report the issue). The
 * provider-level re-validate-and-consume is the atomic check; if a race
 * happens between the two (unlikely — single user clicking once), the
 * provider's atomic flip wins.
 */
export default async function MagicLinkVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  const token = sp.token;

  if (!token) {
    return <FailurePanel reason="not_found" />;
  }

  const validation = await validateMagicLinkToken(token);
  if (!validation.success) {
    return <FailurePanel reason={validation.reason} />;
  }

  // Hand off to the provider for the atomic consume + session create.
  // signIn redirects to /dashboard on success; on failure (race lost
  // between validate and consume) it bounces back to /signin?error=...
  // — also a reasonable UX outcome.
  await signIn("magic-link", {
    token,
    redirectTo: "/dashboard",
  });

  // signIn() throws a NEXT_REDIRECT internally; we shouldn't reach here.
  // Belt-and-braces redirect in case Auth.js changes that contract.
  redirect("/dashboard");
}

const REASON_COPY: Record<string, { title: string; body: string }> = {
  not_found: {
    title: "Sign-in link not found",
    body: "This link wasn't recognized. It may have been mistyped or already deleted. Request a new sign-in link below.",
  },
  expired: {
    title: "Sign-in link expired",
    body: "This link has expired. Sign-in links are valid for 15 minutes after they're issued. Request a new one below.",
  },
  used: {
    title: "Sign-in link already used",
    body: "This link has already been used. Sign-in links are single-use. Request a new one below.",
  },
  user_inactive: {
    title: "Sign-in link not valid",
    body: "This link is no longer valid for sign-in. If you think this is a mistake, contact your advisor.",
  },
};

function FailurePanel({ reason }: { reason: string }) {
  const copy = REASON_COPY[reason] ?? REASON_COPY.not_found;
  return (
    <div className="container mx-auto max-w-md py-16 px-6">
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 space-y-4">
        <h1 className="text-xl font-semibold text-destructive">{copy.title}</h1>
        <p className="text-sm text-foreground/80">{copy.body}</p>
        <div className="flex gap-3 pt-2">
          <Link
            href="/signin"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Request a new link
          </Link>
        </div>
      </div>
    </div>
  );
}
