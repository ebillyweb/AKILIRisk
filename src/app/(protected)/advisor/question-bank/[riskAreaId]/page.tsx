import { redirect } from "next/navigation";
import { legacyRiskAreaRedirect } from "@/lib/assessment/bank/risk-areas";
import { normalizePillarSlug } from "@/lib/assessment/pillar-registry";

/** Legacy read-only question bank → advisor methodology question editor. */
export default async function AdvisorQuestionBankRedirectPage({
  params,
}: {
  params: Promise<{ riskAreaId: string }>;
}) {
  const { riskAreaId } = await params;
  const legacy = legacyRiskAreaRedirect(riskAreaId);
  const slug = normalizePillarSlug(legacy ?? riskAreaId);
  redirect(`/advisor/methodology/questions/${slug}`);
}
