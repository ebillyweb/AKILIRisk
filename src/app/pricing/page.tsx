import type { Metadata } from "next";

import { PricingPageContent } from "@/components/marketing/PricingPageContent";
import { auth } from "@/lib/auth";
import { isAdvisorHubNavRole } from "@/lib/auth-roles";
import { fetchPublicTierPricing } from "@/lib/billing/public-tier-pricing";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "AKILI modular pricing for advisors and enterprise firms — Essentials through Platinum with assessment, customization, implementation tracking, and continuous monitoring.",
};

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const [session, pricing] = await Promise.all([auth(), fetchPublicTierPricing()]);
  const canSubscribe = Boolean(
    session?.user?.id && isAdvisorHubNavRole(session.user.role),
  );

  return <PricingPageContent pricing={pricing} canSubscribe={canSubscribe} />;
}
