import { redirect } from "next/navigation";

/**
 * `/admin/scoring` has no content of its own — `thresholds/` is the only
 * child. Stale links / direct URL typing previously hit the custom 404
 * because the directory had no `page.tsx`. Redirect to the actual page
 * (mirrors the legacy `/admin/question-bank` -> `/admin/assessment/questions`
 * redirect pattern).
 */
export default function AdminScoringIndexRedirect() {
  redirect("/admin/scoring/thresholds");
}
