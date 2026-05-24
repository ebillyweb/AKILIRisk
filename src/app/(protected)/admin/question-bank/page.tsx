import { redirect } from "next/navigation";
import { ADMIN_ASSESSMENT_QUESTIONS_PATH } from "@/lib/admin/assessment-questions-paths";

/** Legacy URL — use `/admin/assessment/questions`. */
export default function LegacyAdminQuestionBankIndexRedirect() {
  redirect(ADMIN_ASSESSMENT_QUESTIONS_PATH);
}
