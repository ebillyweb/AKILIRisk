import { requireAdvisorRiskIntelligenceEnabled } from "@/lib/platform/advisor-feature-guards";

export default async function AdvisorReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdvisorRiskIntelligenceEnabled();
  return <>{children}</>;
}
