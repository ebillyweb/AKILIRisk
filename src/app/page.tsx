import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LandingHero } from "@/components/home/hero/LandingHero";
import { parseHeroAudienceParam } from "@/components/home/hero/hero-audience-persistence";
import { SiteFooter } from "@/components/marketing/SiteFooter";

type HomePageProps = {
  searchParams: Promise<{ audience?: string }>;
};

export default async function Home({ searchParams }: HomePageProps) {
  const session = await auth();
  const { audience: audienceParam } = await searchParams;
  const initialAudience = parseHeroAudienceParam(audienceParam) ?? "families";

  return (
    <>
      <main id="main-content" className="min-h-screen py-6 sm:py-8" tabIndex={-1}>
        <div className="page-shell">
          <LandingHero
            initialAudience={initialAudience}
            authenticated={Boolean(session?.user)}
            userEmail={session?.user?.email}
            authenticatedActions={
              session?.user ? (
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
              ) : undefined
            }
          />

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
