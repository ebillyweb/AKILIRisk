"use client";

import { usePathname } from "next/navigation";

/** Single accessibility heading per advisor route (avoids duplicate visible headers under the main nav). */
function labelForAdvisorPath(pathname: string): string {
  if (pathname === "/advisor" || pathname === "/advisor/") return "Overview";
  if (pathname.startsWith("/advisor/facilitate")) return "Sessions";
  if (pathname.startsWith("/advisor/notifications")) return "Notifications";
  if (pathname.startsWith("/advisor/pipeline")) return "Clients";
  if (pathname.startsWith("/advisor/analytics")) return "Client analytics";
  if (pathname.startsWith("/advisor/review")) return "Assessment review";
  if (pathname.startsWith("/advisor/intelligence")) return "Risk intelligence";
  if (pathname.startsWith("/advisor/enterprise/methodology")) return "Practice Standards";
  if (pathname.startsWith("/advisor/methodology")) return "Your methodology";
  if (pathname.startsWith("/advisor/question-bank")) return "Question bank";
  if (pathname.startsWith("/advisor/settings/notifications"))
    return "Notification settings";
  if (pathname.startsWith("/advisor/settings/branding")) return "Brand";
  if (pathname.startsWith("/advisor/settings/team")) return "Team";
  if (pathname.startsWith("/advisor/settings/access-control")) return "Roles & Permissions";
  if (pathname.startsWith("/advisor/settings")) return "Account settings";
  if (pathname.startsWith("/advisor/invitations") || pathname.startsWith("/advisor/invite"))
    return "Invitations";
  if (pathname.startsWith("/advisor/dashboard")) return "Risk analytics";
  if (pathname.startsWith("/advisor/billing")) return "Billing";
  if (pathname.startsWith("/advisor/cyber-risk")) return "Cyber risk";
  if (pathname.startsWith("/advisor/identity-risk")) return "Identity risk";
  return "Advisor";
}

export function AdvisorSrOnlyHeading() {
  const pathname = usePathname() || "";
  return <h1 className="sr-only">{labelForAdvisorPath(pathname)}</h1>;
}
