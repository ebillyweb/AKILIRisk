import Link from "next/link";
import { AuthLeftPaneSupplement } from "@/components/auth/AuthLeftPaneSupplement";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, Sparkles, Waypoints } from "lucide-react";
import { AkiliLogoLockup } from "@/components/home/AkiliLogoLockup";
import { SiteFooter } from "@/components/marketing/SiteFooter";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen py-6 sm:py-8">
      <div className="page-shell">
        <div className="hero-surface app-grid grid min-h-[calc(100vh-3rem)] overflow-hidden rounded-[2rem] lg:grid-cols-[1.05fr_0.95fr]">
          <section className="order-2 flex flex-col justify-between gap-8 border-t section-divider px-6 py-6 sm:px-8 lg:order-1 lg:border-t-0 lg:border-r lg:px-12 lg:py-12">
            <div className="space-y-6">
              <p className="editorial-kicker">Governance Assessment</p>
              <div className="max-w-xl space-y-4">
                <h1 className="text-4xl font-semibold leading-none text-balance sm:text-5xl lg:text-6xl">
                  A calmer, more intentional way to assess governance risk.
                </h1>
                <p className="text-base leading-7 text-muted-foreground sm:text-lg">
                  Purpose-built for high-trust relationships, with a visual
                  language that feels discreet, editorial, and modern on every screen.
                </p>
              </div>
              <AuthLeftPaneSupplement />
            </div>

            <div className="hidden gap-4 sm:grid-cols-3 lg:grid">
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

          <section className="order-1 flex flex-col gap-6 px-4 py-6 sm:px-8 lg:order-2 lg:px-12">
            <div className="flex w-full justify-end">
              <Link href="/" className="text-foreground" aria-label="AKILI home">
                <AkiliLogoLockup className="h-auto w-full max-w-[280px]" />
              </Link>
            </div>
            <div id="main-content" className="flex w-full max-w-xl flex-1 items-center justify-center" tabIndex={-1}>{children}</div>
          </section>
        </div>

        <SiteFooter className="mt-8" />
      </div>
    </div>
  );
}
