import Link from "next/link";
import { AuthLeftPaneSupplement } from "@/components/auth/AuthLeftPaneSupplement";
import { HeroFeatureCard } from "@/components/home/hero/HeroFeatureCard";
import { HOME_HERO_FEATURES } from "@/components/home/hero/home-hero-features";
import { AkiliLogoLockup } from "@/components/home/AkiliLogoLockup";
import { SiteFooter } from "@/components/marketing/SiteFooter";

export function DefaultAuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen py-6 sm:py-8">
      <div className="page-shell">
        <div className="hero-surface app-grid grid min-h-[calc(100vh-3rem)] overflow-hidden rounded-[2rem] lg:grid-cols-[1.05fr_0.95fr]">
          <section className="order-2 flex flex-col justify-between gap-8 border-t section-divider px-6 py-6 sm:px-8 lg:order-1 lg:border-t-0 lg:border-r lg:px-12 lg:py-12">
            <div className="space-y-6">
              <p className="editorial-kicker">Personal Risk Profile</p>
              <div className="max-w-xl space-y-4">
                <h1 className="text-4xl font-semibold leading-none text-balance sm:text-5xl lg:text-6xl">
                  A calmer, more intentional way to assess governance risk.
                </h1>
                <p className="text-base leading-7 text-muted-foreground sm:text-lg">
                  Purpose-built for high-trust relationships, with a visual
                  language that feels discreet, editorial, and modern.
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

          <section className="order-1 flex flex-col gap-6 px-4 py-6 sm:px-8 lg:order-2 lg:px-12">
            <div className="flex w-full justify-end">
              <Link href="/" className="text-foreground" aria-label="AKILI home">
                <AkiliLogoLockup className="h-auto w-full max-w-[280px]" />
              </Link>
            </div>
            <div
              id="main-content"
              className="flex w-full min-w-0 max-w-xl flex-1 items-center justify-center"
              tabIndex={-1}
            >
              {children}
            </div>
          </section>
        </div>

        <SiteFooter className="mt-8" />
      </div>
    </div>
  );
}
