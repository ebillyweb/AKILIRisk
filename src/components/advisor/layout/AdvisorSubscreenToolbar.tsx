"use client";

import { usePathname } from "next/navigation";

import { AdvisorHeaderActions } from "./AdvisorHeaderActions";

/** Plan badge + product tour on every advisor route except the workspace home. */
export function AdvisorSubscreenToolbar() {
  const pathname = usePathname() ?? "";
  const isAdvisorHome = pathname === "/advisor" || pathname === "/advisor/";
  const isAdvisorRoute = pathname.startsWith("/advisor");

  if (!isAdvisorRoute || isAdvisorHome) {
    return null;
  }

  // Pipeline merges client actions with this toolbar on the page itself.
  if (pathname === "/advisor/pipeline") {
    return null;
  }

  return (
    <div className="mb-4 flex items-center justify-end">
      <AdvisorHeaderActions />
    </div>
  );
}
