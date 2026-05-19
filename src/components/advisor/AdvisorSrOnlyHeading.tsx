"use client";

import { usePathname } from "next/navigation";

/** Single accessibility heading per advisor route (avoids duplicate visible headers under the main nav). */
function labelForAdvisorPath(pathname: string): string {
  if (pathname === "/advisor" || pathname === "/advisor/") return "Advisor workspace";
  if (pathname.startsWith("/advisor/pipeline")) return "Client pipeline";
  if (pathname.startsWith("/advisor/analytics")) return "Client analytics";
  if (pathname.startsWith("/advisor/review")) return "Assessment review";
  if (pathname.startsWith("/advisor/intelligence")) return "Risk intelligence";
  if (pathname.startsWith("/advisor/question-bank")) return "Question bank";
  if (pathname.startsWith("/advisor/settings/notifications"))
    return "Notification settings";
  if (pathname.startsWith("/advisor/settings")) return "Settings";
  if (pathname.startsWith("/advisor/invitations")) return "Client invitations";
  if (pathname.startsWith("/advisor/dashboard")) return "Governance dashboard";
  if (pathname.startsWith("/advisor/notifications")) return "Notifications";
  if (pathname.startsWith("/advisor/billing")) return "Billing";
  if (pathname.startsWith("/advisor/cyber-risk")) return "Cyber risk";
  if (pathname.startsWith("/advisor/identity-risk")) return "Identity risk";
  if (pathname.startsWith("/advisor/invite")) return "Invite client";
  return "Advisor";
}

export function AdvisorSrOnlyHeading() {
  const pathname = usePathname() || "";
  return <h1 className="sr-only">{labelForAdvisorPath(pathname)}</h1>;
}
