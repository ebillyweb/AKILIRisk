import { redirect } from "next/navigation";
import { adminAssessmentQuestionsEditPath } from "@/lib/admin/assessment-questions-paths";

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

/** Legacy URL — use `/admin/assessment/questions/[riskAreaId]/[questionId]`. */
export default async function LegacyAdminQuestionBankEditRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ riskAreaId: string; questionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { riskAreaId, questionId } = await params;
  const sp = await searchParams;
  redirect(
    `${adminAssessmentQuestionsEditPath(riskAreaId, questionId)}${queryString(sp)}`
  );
}
