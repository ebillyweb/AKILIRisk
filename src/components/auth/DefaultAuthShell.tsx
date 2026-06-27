import Link from "next/link";
import { AuthLeftPaneSupplement } from "@/components/auth/AuthLeftPaneSupplement";
import { HeroFeatureCard } from "@/components/home/hero/HeroFeatureCard";
import { HOME_HERO_FEATURES } from "@/components/home/hero/home-hero-features";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SiteHeader } from "@/components/marketing/SiteHeader";

export function DefaultAuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen pb-10 pt-2 sm:pb-12">
      <a href="#main-content" className="skip-to-content">
        Skip to main content
      </a>
      <div className="page-shell">
        <SiteHeader />
        <div className="hero-surface app-grid mt-6 grid overflow-hidden rounded-[2rem] lg:grid-cols-[1.05fr_0.95fr]">
          <section className="order-2 flex flex-col justify-between gap-8 border-t section-divider px-6 py-8 sm:px-8 lg:order-1 lg:border-t-0 lg:border-r lg:px-12 lg:py-12">
            <div className="space-y-6">
              <p className="editorial-kicker">AKILI Risk Intelligence</p>
              <div className="max-w-xl space-y-4">
                <h1 className="text-4xl font-semibold leading-[1.05] text-balance sm:text-5xl">
                  Governance intelligence you can act on.
                </h1>
                <p className="text-base leading-7 text-muted-foreground sm:text-lg">
                  Structured assessments, prioritized risks, and advisor-ready
                  recommendations — designed for high-trust family and advisory
                  relationships.
                </p>
              </div>
              <AuthLeftPaneSupplement />
            </div>

            <div className="hidden gap-4 sm:grid-cols-3 lg:grid">
              {HOME_HERO_FEATURES.map((feature) => (
                <HeroFeatureCard
                  key={feature.title}
                  title={feature.title}
                  description={feature.description}
                  icon={feature.icon}
                />
              ))}
            </div>
          </section>

          <section className="order-1 flex flex-col gap-6 px-4 py-6 sm:px-8 lg:order-2 lg:px-12 lg:py-10">
            <div className="flex w-full justify-end lg:hidden">
              <Link href="/" className="text-sm font-semibold text-foreground hover:underline">
                Back to home
              </Link>
            </div>
            <div
              id="main-content"
              className="flex w-full min-w-0 max-w-xl flex-1 items-center justify-center lg:mx-auto"
              tabIndex={-1}
            >
              {children}
            </div>
          </section>
        </div>

        <SiteFooter className="mt-12" />
      </div>
    </div>
  );
}
