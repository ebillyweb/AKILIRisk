"use client";

import { usePathname } from "next/navigation";

import { getAdvisorTourIdForPath } from "@/lib/product-tour/advisor-path-tours";

import { AdvisorHeaderActions } from "./AdvisorHeaderActions";

/** Product tour on advisor sub-routes except workspace home (pipeline merges on its page). */
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

  if (!getAdvisorTourIdForPath(pathname)) {
    return null;
  }

  return (
    <div className="mb-4 flex items-center justify-end">
      <AdvisorHeaderActions />
    </div>
  );
}
