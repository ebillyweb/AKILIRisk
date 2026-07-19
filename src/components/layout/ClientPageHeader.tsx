"use client";

import { usePathname } from "next/navigation";
import { useBrandingOptional } from "@/components/providers/BrandingProvider";
import { getPreviewBrandHex, type PreviewBrandHex } from "@/lib/branding/preview-hex";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  ClipboardCheck,
  Users,
  Settings,
  LifeBuoy,
  type LucideIcon,
} from "lucide-react";
import {
  getClientPageHeaderConfig,
  type ClientPageHeaderConfig,
  type ClientPageHeaderIconName,
} from "@/components/layout/client-page-header-config";

const CLIENT_HEADER_ICONS: Record<ClientPageHeaderIconName, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  "file-text": FileText,
  "clipboard-check": ClipboardCheck,
  users: Users,
  settings: Settings,
  "life-buoy": LifeBuoy,
};

export function ClientPageHeader(
  props: ClientPageHeaderConfig & { brandHex?: PreviewBrandHex | null },
) {
  const { icon, kicker, title, subtitle, brandHex } = props;
  const Icon = CLIENT_HEADER_ICONS[icon];
  return (
    <header
      role="banner"
      className={cn(
        "client-header professional-header",
        brandHex && "client-header-branded",
      )}
      style={
        brandHex
          ? ({
              "--client-brand-primary": brandHex.primary,
            } as React.CSSProperties)
          : undefined
      }
    >
      <div className="flex items-start gap-3 sm:gap-4 header-section-spacing">
        <div
          className="professional-icon shrink-0"
          role="img"
          aria-label={`${title} section icon`}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1 space-y-2 sm:space-y-3">
          <p
            className="professional-kicker"
            id="client-section-context"
            role="doc-subtitle"
          >
            {kicker}
          </p>
          <h1
            className="professional-title text-balance"
            aria-describedby="client-section-context client-subtitle"
          >
            {title}
          </h1>
          {subtitle ? (
            <p
              className="professional-subtitle"
              id="client-subtitle"
              role="doc-subtitle"
              aria-label={`Page description: ${subtitle}`}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
    </header>
  );
}

/**
 * Enhanced client page header with professional accessibility features.
 * Returns null for non-client routes (e.g. /advisor/*). Use in protected layout so client pages get the same header style.
 */
export function ClientPageHeaderFromPath() {
  const pathname = usePathname();
  const config = getClientPageHeaderConfig(pathname);
  const branding = useBrandingOptional()?.branding ?? null;
  const brandHex = branding ? getPreviewBrandHex(branding) : null;
  if (!config) return null;

  return (
    <>
      <ClientPageHeader {...config} brandHex={brandHex} />
    </>
  );
}
