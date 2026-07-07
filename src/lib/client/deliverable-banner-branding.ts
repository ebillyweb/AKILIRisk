import type { CSSProperties } from "react";
import {
  getPreviewBrandHex,
  type PreviewBrandHex,
} from "@/lib/branding/preview-hex";
import { clientPortalBrandingDisplayTitle } from "@/lib/client/client-portal-branding";
import type { AdvisorBrandingData } from "@/lib/validation/branding";

export type DeliverableBannerBrandingProps = {
  advisorTeamLabel: string;
  brandHex: PreviewBrandHex | null;
};

export function hexWithAlpha(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function deliverableBannerSurfaceStyle(
  brandHex: PreviewBrandHex | null,
  tone: "primary" | "accent" | "success",
): CSSProperties | undefined {
  if (!brandHex) return undefined;

  const accent =
    tone === "accent"
      ? brandHex.accent
      : tone === "success"
        ? brandHex.accent
        : brandHex.primary;

  return {
    borderColor: hexWithAlpha(accent, 0.35),
    backgroundColor: hexWithAlpha(brandHex.secondary, 0.92),
    color: brandHex.primary,
  };
}

export function deliverableBannerBrandingProps(
  branding: AdvisorBrandingData | null | undefined,
): DeliverableBannerBrandingProps {
  return {
    advisorTeamLabel: branding
      ? clientPortalBrandingDisplayTitle(branding)
      : "your advisor",
    brandHex: branding ? getPreviewBrandHex(branding) : null,
  };
}
