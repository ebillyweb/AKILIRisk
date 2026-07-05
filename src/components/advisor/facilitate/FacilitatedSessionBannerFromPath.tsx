"use client";

import { usePathname } from "next/navigation";

import { FacilitatedSessionBanner } from "./FacilitatedSessionBanner";

const STEP_LABELS: Record<string, string> = {
  intake: "Completing intake",
  "risk-domains": "Selecting risk domains",
  assessment: "Conducting assessment",
  preview: "Reviewing risk preview",
};

function labelForPath(pathname: string): string {
  if (pathname.includes("/intake")) return STEP_LABELS.intake;
  if (pathname.includes("/risk-domains")) return STEP_LABELS["risk-domains"];
  if (pathname.includes("/preview")) return STEP_LABELS.preview;
  if (pathname.includes("/assessment")) return STEP_LABELS.assessment;
  return "Facilitated session";
}

export function FacilitatedSessionBannerFromPath({
  clientName,
}: {
  clientName: string | null;
}) {
  const pathname = usePathname();
  return (
    <FacilitatedSessionBanner
      clientName={clientName}
      stepLabel={labelForPath(pathname)}
    />
  );
}
