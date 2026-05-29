import { requireAdvisorRiskIntelligenceEnabled } from "@/lib/platform/advisor-feature-guards";

export default async function AdvisorRecommendationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdvisorRiskIntelligenceEnabled();
  return <>{children}</>;
}
