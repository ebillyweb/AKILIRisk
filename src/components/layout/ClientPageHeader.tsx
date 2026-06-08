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
  type LucideIcon,
} from "lucide-react";

export interface ClientPageHeaderConfig {
  icon: LucideIcon;
  kicker: string;
  title: string;
  subtitle?: string;
}

const CLIENT_HEADER_CONFIG: { path: string; config: ClientPageHeaderConfig }[] = [
  {
    path: "/dashboard",
    config: {
      icon: LayoutDashboard,
      kicker: "Client Portal",
      title: "Dashboard",
      subtitle:
        "Assessment progress, results, and secure account management",
    },
  },
  {
    path: "/intake",
    config: {
      icon: FileText,
      kicker: "Family Assessment",
      title: "Family Governance Intake",
      subtitle:
        "Confidential family governance intake interview",
    },
  },
  {
    path: "/assessment",
    config: {
      icon: ClipboardCheck,
      kicker: "Family Assessment",
      title: "Governance Assessment",
      subtitle:
        "Comprehensive evaluation of governance structure and family decision-making practices",
    },
  },
  {
    path: "/profiles",
    config: {
      icon: Users,
      kicker: "Family Structure",
      title: "Household Profiles",
      subtitle:
        "Family member profiles and governance participation roles",
    },
  },
  {
    path: "/settings",
    config: {
      icon: Settings,
      kicker: "Account Security",
      title: "Security & Access",
      subtitle:
        "Account identity verification and multi-factor authentication",
    },
  },
];

function getHeaderConfig(pathname: string): ClientPageHeaderConfig | null {
  const match = CLIENT_HEADER_CONFIG.find(
    ({ path }) => pathname === path || pathname.startsWith(`${path}/`)
  );
  return match?.config ?? null;
}

export function getClientPageHeaderConfig(
  pathname: string
): ClientPageHeaderConfig | null {
  return getHeaderConfig(pathname);
}

export function ClientPageHeader(
  props: ClientPageHeaderConfig & { brandHex?: PreviewBrandHex | null },
) {
  const { icon: Icon, kicker, title, subtitle, brandHex } = props;
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
  const config = getHeaderConfig(pathname);
  const branding = useBrandingOptional()?.branding ?? null;
  const brandHex = branding ? getPreviewBrandHex(branding) : null;
  if (!config) return null;

  return (
    <>
      <ClientPageHeader {...config} brandHex={brandHex} />
    </>
  );
}
