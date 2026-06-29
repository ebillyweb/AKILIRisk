import type { TourId } from "@/lib/product-tour/types";

/**
 * Maps advisor hub routes to product tour IDs.
 * Used by AdvisorHeaderActions when a page does not pass an explicit tourId.
 */
export function getAdvisorTourIdForPath(pathname: string): TourId | null {
  if (pathname === "/advisor/settings") return "advisor-settings";
  if (pathname === "/advisor/settings/pii-policy") return "advisor-settings-pii-policy";
  if (pathname === "/advisor/settings/team") return "advisor-settings-team";

  if (pathname === "/advisor/methodology") return "advisor-methodology-hub";
  if (pathname === "/advisor/methodology/pillars") return "advisor-methodology-pillars";
  if (pathname === "/advisor/methodology/intake") return "advisor-methodology-intake";
  if (pathname.startsWith("/advisor/methodology/questions/")) {
    return "advisor-methodology-questions";
  }
  if (pathname.startsWith("/advisor/methodology/narratives/")) {
    return "advisor-methodology-narratives";
  }
  if (pathname.startsWith("/advisor/methodology/recommendations/")) {
    return "advisor-recommendation-rules";
  }
  if (pathname === "/advisor/methodology/versions") return "advisor-methodology-versions";
  if (pathname === "/advisor/methodology/catalog-updates") {
    return "advisor-methodology-catalog-updates";
  }

  if (pathname === "/advisor/enterprise/methodology") return "advisor-methodology-hub";
  if (pathname === "/advisor/enterprise/methodology/pillars") {
    return "advisor-methodology-pillars";
  }
  if (pathname === "/advisor/enterprise/methodology/intake") {
    return "advisor-methodology-intake";
  }
  if (pathname.startsWith("/advisor/enterprise/methodology/questions/")) {
    return "advisor-methodology-questions";
  }
  if (pathname.startsWith("/advisor/enterprise/methodology/narratives/")) {
    return "advisor-methodology-narratives";
  }

  if (pathname === "/advisor/enterprise/recommendations") {
    return "enterprise-recommendation-rules-index";
  }
  if (pathname.startsWith("/advisor/enterprise/recommendations/")) {
    return "enterprise-recommendation-rules";
  }

  if (pathname === "/advisor/pipeline") return "advisor-pipeline";
  if (/^\/advisor\/pipeline\/[^/]+$/.test(pathname)) return "advisor-pipeline-client";

  if (pathname.startsWith("/advisor/leads")) return "advisor-leads";
  if (pathname.startsWith("/advisor/engagements") || pathname.startsWith("/advisor/engagement")) {
    return "advisor-engagements";
  }
  if (pathname.startsWith("/advisor/signals")) return "advisor-signals";
  if (pathname.startsWith("/advisor/reports")) return "advisor-reports";
  if (pathname.startsWith("/advisor/recommendations")) return "advisor-recommendations-hub";
  if (pathname.startsWith("/advisor/facilitate")) return "advisor-facilitate";
  if (pathname.startsWith("/advisor/reassessment")) return "advisor-reassessment";
  if (pathname.startsWith("/advisor/invitations") || pathname.startsWith("/advisor/invite")) {
    return "advisor-invitations";
  }
  if (pathname.startsWith("/advisor/billing")) return "advisor-billing";
  if (pathname.startsWith("/advisor/intelligence")) return "advisor-intelligence";
  if (pathname.startsWith("/advisor/notifications")) return "advisor-notifications";

  if (pathname.startsWith("/advisor/")) return "advisor-workspace-fallback";

  return null;
}
