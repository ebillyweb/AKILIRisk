import { redirect } from "next/navigation";
import { adminAssessmentQuestionsNewPath } from "@/lib/admin/assessment-questions-paths";

function queryString(
  searchParams: Record<string, string | string[] | undefined>
): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") qs.set(key, value);
    else if (Array.isArray(value)) {
      for (const v of value) qs.append(key, v);
    }
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

/** Legacy URL — use `/admin/assessment/questions/[riskAreaId]/new`. */
export default async function LegacyAdminQuestionBankNewRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ riskAreaId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { riskAreaId } = await params;
  const sp = await searchParams;
  redirect(`${adminAssessmentQuestionsNewPath(riskAreaId)}${queryString(sp)}`);
}
