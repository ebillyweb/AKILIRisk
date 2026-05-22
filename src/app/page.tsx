import Link from "next/link";
import { ArrowRight, ShieldCheck, Sparkles, Waypoints } from "lucide-react";
import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AkiliLogoLockup } from "@/components/home/AkiliLogoLockup";
import { SiteFooter } from "@/components/marketing/SiteFooter";

export default async function Home() {
  const session = await auth();

  return (
    <>
      <main id="main-content" className="min-h-screen py-6 sm:py-8" tabIndex={-1}>
      <div className="page-shell">
        <div className="hero-surface app-grid grid min-h-[calc(100vh-3rem)] overflow-hidden rounded-[2rem] px-6 py-8 sm:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:px-12 lg:py-10">
          <section className="flex flex-col justify-between gap-8 lg:gap-10">
            <div className="space-y-7">
              <div className="space-y-4">
                <p className="editorial-kicker">Governance Assessment</p>
                <div className="max-w-3xl space-y-4">
                  <h1 className="text-4xl font-semibold leading-none text-balance sm:text-6xl lg:text-[4.5rem]">
                    The governance intelligence platform for modern family
                    wealth.
                  </h1>
                  <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                    A discreet digital governance assessment designed to
                    identify structural risks and strengthen family decision
                    frameworks.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    12–15 minute governance assessment
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                {session?.user ? (
                  <>
                    <Button asChild size="lg" className="sm:min-w-44">
                      <Link href="/dashboard">
                        Go to Dashboard
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                    <form
                      action={async () => {
                        "use server";
                        await signOut({ redirectTo: "/" });
                      }}
                    >
                      <Button
                        type="submit"
                        size="lg"
                        variant="outline"
                        className="w-full sm:min-w-44"
                      >
                        Sign Out
                      </Button>
                    </form>
                  </>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-3 md:flex-row">
                      <Button
                        asChild
                        size="lg"
                        className="w-full whitespace-normal min-h-12 text-center sm:min-w-[13rem] sm:flex-1 sm:px-5"
                      >
                        <Link
                          href="/start"
                          title="Start your governance assessment"
                        >
                          Start Assessment
                          <ArrowRight className="size-4" />
                        </Link>
                      </Button>
                      <Button
                        asChild
                        size="lg"
                        variant="outline"
                        className="w-full sm:min-w-0 sm:flex-1"
                      >
                        <Link
                          href="/signin?portal=advisor"
                          title="Sign in to the advisor portal"
                        >
                          Advisor Portal
                        </Link>
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Already have an account?{" "}
                      <Link
                        href="/signin"
                        className="font-semibold text-foreground underline-offset-4 hover:underline"
                      >
                        Sign in
                      </Link>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Looking for an advisor?{" "}
                      <Link
                        href="/request-review"
                        className="font-semibold text-foreground underline-offset-4 hover:underline"
                      >
                        Request a review here
                      </Link>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Private and encrypted. Responses visible only to your
                      advisor.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="group gap-0 rounded-[1.25rem] border border-border/70 bg-card/80 py-0 shadow-[0_1px_0_0_rgba(255,255,255,0.6)_inset] transition-all duration-200 hover:border-brand/30 hover:bg-card hover:shadow-[0_8px_30px_-12px_rgba(26,24,20,0.12)]">
                <CardContent className="space-y-4 p-5 sm:p-6">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand transition-colors duration-200 group-hover:bg-brand/15">
                    <ShieldCheck className="size-5" aria-hidden />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-base font-semibold leading-tight text-foreground">
                      Governance Risk Identification
                    </h3>
                    <p className="text-sm leading-6 text-muted-foreground">
                      Surface structural governance gaps before they become
                      disputes.
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="group gap-0 rounded-[1.25rem] border border-border/70 bg-card/80 py-0 shadow-[0_1px_0_0_rgba(255,255,255,0.6)_inset] transition-all duration-200 hover:border-brand/30 hover:bg-card hover:shadow-[0_8px_30px_-12px_rgba(26,24,20,0.12)]">
                <CardContent className="space-y-4 p-5 sm:p-6">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand transition-colors duration-200 group-hover:bg-brand/15">
                    <Waypoints className="size-5" aria-hidden />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-base font-semibold leading-tight text-foreground">
                      Advisor-Guided Assessment
                    </h3>
                    <p className="text-sm leading-6 text-muted-foreground">
                      A structured interview designed for families and their
                      advisors.
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="group gap-0 rounded-[1.25rem] border border-border/70 bg-card/80 py-0 shadow-[0_1px_0_0_rgba(255,255,255,0.6)_inset] transition-all duration-200 hover:border-brand/30 hover:bg-card hover:shadow-[0_8px_30px_-12px_rgba(26,24,20,0.12)]">
                <CardContent className="space-y-4 p-5 sm:p-6">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand transition-colors duration-200 group-hover:bg-brand/15">
                    <Sparkles className="size-5" aria-hidden />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-base font-semibold leading-tight text-foreground">
                      Continuity Intelligence
                    </h3>
                    <p className="text-sm leading-6 text-muted-foreground">
                      Receive governance recommendations and succession
                      frameworks.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          <aside className="mt-12 flex flex-col items-stretch gap-8 lg:mt-0 lg:pl-10">
            <div className="flex w-full justify-end text-foreground">
              <AkiliLogoLockup className="h-auto w-full max-w-[280px]" />
            </div>
            <Card className="w-full overflow-hidden">
              <CardContent className="space-y-8 pt-8">
                <div className="space-y-2">
                  <p className="editorial-kicker">Our Company Ethos</p>
                  <p className="text-xl font-medium leading-8 text-balance text-foreground/90">
                    Governance requires clarity, not assumption.
                  </p>
                  <p className="border-l-2 border-brand/30 pl-4 text-base font-medium italic leading-7 text-foreground/90">
                    Wealth grows through investment.
                    <br />
                    Legacy survives through governance.
                  </p>
                  <p className="text-sm leading-7 text-muted-foreground">
                    Families often operate with informal decision structures
                    that work — until they don’t.
                  </p>
                </div>

                <p className="text-sm leading-7 text-muted-foreground">
                  This assessment identifies governance gaps across succession
                  planning, authority structure, and family decision frameworks
                  so they can be addressed proactively.
                </p>

                <div className="section-divider border-t pt-6 text-sm text-muted-foreground">
                  {session?.user ? (
                    <>
                      Signed in as{" "}
                      <span className="font-semibold text-foreground">
                        {session.user.email}
                      </span>
                      . Continue to the dashboard, review recommendations, and
                      manage account security settings.
                    </>
                  ) : (
                    <>
                      Existing clients can sign in to continue an assessment,
                      review recommendations, and manage account security
                      settings.
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>

        {/* Who This Is For — positioning */}
        <section className="mt-8">
          <h2 className="editorial-kicker mb-5 text-sm font-medium uppercase tracking-wide text-muted-foreground sm:mb-6">
            Designed For
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-[1.25rem] border border-border/70 bg-card/80 px-5 py-5 sm:px-6 sm:py-6">
              <h3 className="text-base font-semibold text-foreground">
                Family Offices
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Identify governance risks across multi-generational households.
              </p>
            </div>
            <div className="rounded-[1.25rem] border border-border/70 bg-card/80 px-5 py-5 sm:px-6 sm:py-6">
              <h3 className="text-base font-semibold text-foreground">
                Wealth Advisors
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Provide structured governance guidance alongside financial
                planning.
              </p>
            </div>
            <div className="rounded-[1.25rem] border border-border/70 bg-card/80 px-5 py-5 sm:px-6 sm:py-6">
              <h3 className="text-base font-semibold text-foreground">
                Family Leadership
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Strengthen decision frameworks and succession continuity.
              </p>
            </div>
          </div>
        </section>

        {/* Governance Intelligence at a Glance — score teaser */}
        <section className="mt-8 rounded-[1.75rem] border border-border/70 bg-card/80 px-5 py-5 sm:px-6 sm:py-6">
          <h2 className="editorial-kicker mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Governance Intelligence at a Glance
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:gap-8">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                AKILI Governance Score
              </h3>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground sm:text-3xl">
                7.2{" "}
                <span className="font-normal text-muted-foreground">/ 10</span>
                <span className="ml-2 text-base font-medium normal-nums text-muted-foreground sm:text-lg">
                  – Moderate Risk
                </span>
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Top Identified Risks
              </h3>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm leading-6 text-muted-foreground">
                <li>No defined succession triggers</li>
                <li>Informal authority structure</li>
                <li>No documented governance framework</li>
              </ul>
            </div>
          </div>
        </section>

        <p className="mt-10 text-center text-sm text-muted-foreground">
          Built for the advisory process used by AKILI Risk Intelligence.
        </p>

        <SiteFooter className="mt-10" />
      </div>
    </main>
    </>
  );
}
