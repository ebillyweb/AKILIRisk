import Link from "next/link";

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

export default async function MagicLinkFailedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const sp = await searchParams;
  const copy = REASON_COPY[sp.reason ?? ""] ?? REASON_COPY.not_found;

  return (
    <div className="container mx-auto max-w-md py-16 px-6">
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 space-y-4">
        <h1 className="text-xl font-semibold text-destructive">{copy.title}</h1>
        <p className="text-sm text-foreground/80">{copy.body}</p>
        <div className="flex gap-3 pt-2">
          <Link
            href="/signin/magic-link"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Request a new link
          </Link>
        </div>
      </div>
    </div>
  );
}
