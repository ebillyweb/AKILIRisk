import type { TourId } from "@/lib/product-tour/types";

/**
 * Maps admin routes to product tour IDs for configuration screens.
 * Used by AdminPageHeaderFromPath to show the tour button automatically.
 */
export function getAdminTourIdForPath(pathname: string): TourId | null {
  if (pathname === "/admin/intake/questions") return "admin-intake-questions";
  if (pathname.startsWith("/admin/intake/questions/")) return "admin-intake-question-edit";

  if (pathname === "/admin/assessment/questions") return "admin-assessment-questions-index";

  const assessmentParts = pathname.split("/").filter(Boolean);
  if (
    assessmentParts[0] === "admin" &&
    assessmentParts[1] === "assessment" &&
    assessmentParts[2] === "questions" &&
    assessmentParts.length >= 4
  ) {
    if (assessmentParts.length === 4) return "admin-assessment-questions-area";
    if (assessmentParts[4] === "new" || assessmentParts.length === 5) {
      return "admin-assessment-question-form";
    }
  }

  if (pathname === "/admin/scoring/thresholds") return "admin-scoring-thresholds";
  if (pathname === "/admin/settings") return "admin-platform-settings";

  if (pathname === "/admin/recommendations/services/new") {
    return "admin-recommendation-service-form";
  }
  if (/^\/admin\/recommendations\/services\/[^/]+\/edit$/.test(pathname)) {
    return "admin-recommendation-service-form";
  }

  return null;
}
