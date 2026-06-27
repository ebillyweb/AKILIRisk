import Link from "next/link";
import { ArrowRight, Compass, ShieldAlert } from "lucide-react";
import { AkiliLogoLockup } from "@/components/home/AkiliLogoLockup";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFound() {
  return (
    <main id="main-content" className="min-h-screen py-6 sm:py-8" tabIndex={-1}>
      <div className="page-shell">
        <section className="hero-surface grid min-h-[calc(100vh-3rem)] place-items-center overflow-hidden rounded-[2rem] px-6 py-10 sm:px-8">
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-8 text-center">
            <Link href="/" className="inline-flex text-foreground" aria-label="AKILI home">
              <AkiliLogoLockup className="h-auto w-full max-w-[240px]" />
            </Link>

            <div className="space-y-4">
              <p className="editorial-kicker">404 | Route Not Found</p>
              <h1 className="text-4xl font-semibold leading-none text-balance sm:text-5xl">
                This page did not pass due diligence.
              </h1>
              <p className="mx-auto max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                We ran the full governance scan and could not verify this URL.
                It may have moved, expired, or never existed.
              </p>
            </div>

            <div className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="sm:flex-1">
                <Link href="/">
                  Return Home
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="sm:flex-1">
                <Link href="/start">Start Assessment</Link>
              </Button>
            </div>

            <div className="grid w-full gap-4 sm:grid-cols-2">
              <Card className="rounded-[1.25rem] border border-border/70 bg-card/80 py-0">
                <CardContent className="space-y-2 p-5 text-left sm:p-6">
                  <div className="flex items-center gap-2 text-brand">
                    <Compass className="size-4" aria-hidden />
                    <p className="text-sm font-semibold text-foreground">
                      Quick Navigation
                    </p>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Visit your dashboard, advisor portal, or assessment start
                    page from the main site.
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-[1.25rem] border border-border/70 bg-card/80 py-0">
                <CardContent className="space-y-2 p-5 text-left sm:p-6">
                  <div className="flex items-center gap-2 text-brand">
                    <ShieldAlert className="size-4" aria-hidden />
                    <p className="text-sm font-semibold text-foreground">
                      Need Secure Access?
                    </p>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    If you expected a private page, sign in again to refresh
                    your authenticated session.
                  </p>
                  <Link
                    href="/signin"
                    className="inline-flex text-sm font-semibold text-foreground underline-offset-4 hover:underline"
                  >
                    Sign in
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
