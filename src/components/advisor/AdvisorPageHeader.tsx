"use client";

import { usePathname } from "next/navigation";
import {
  Users,
  GitBranch,
  Send,
  LayoutDashboard,
  Shield,
  Bell,
  Settings,
  CreditCard,
  type LucideIcon,
} from "lucide-react";

export interface AdvisorPageHeaderConfig {
  icon: LucideIcon;
  kicker: string;
  title: string;
  subtitle?: string;
  metadata?: {
    timestamp?: string;
    userRole?: string;
    pathname?: string;
  };
}

const ADVISOR_HEADER_CONFIG: { path: string; config: AdvisorPageHeaderConfig }[] = [
  { path: "/advisor", config: { icon: Users, kicker: "Advisor hub", title: "Overview", subtitle: "Pipeline health, priorities, and quick links" } },
  { path: "/advisor/pipeline", config: { icon: GitBranch, kicker: "Clients", title: "All Clients", subtitle: "Active and inactive client workflows in one place" } },
  { path: "/advisor/invitations", config: { icon: Send, kicker: "Client Engagement", title: "Client Invitations", subtitle: "Assessment invitation management and client onboarding" } },
  { path: "/advisor/dashboard", config: { icon: LayoutDashboard, kicker: "Portfolio Intelligence", title: "Governance Dashboard", subtitle: "Comprehensive governance analytics and client family risk assessment overview" } },
  { path: "/advisor/intelligence", config: { icon: Shield, kicker: "Risk Management", title: "Risk Intelligence", subtitle: "Portfolio risk assessment and governance vulnerability analysis" } },
  { path: "/advisor/notifications", config: { icon: Bell, kicker: "Activity Management", title: "Notifications", subtitle: "Client activity updates and priority alerts" } },
  { path: "/advisor/billing", config: { icon: CreditCard, kicker: "Subscription", title: "Billing", subtitle: "Plan, usage, and Stripe invoices for your practice" } },
  { path: "/advisor/settings", config: { icon: Settings, kicker: "Professional Profile", title: "Settings", subtitle: "Professional profile and client-facing branding configuration" } },
];

function getHeaderConfig(pathname: string): AdvisorPageHeaderConfig | null {
  // Only match exact path so nested routes (e.g. /advisor/pipeline/[clientId]) keep their own title
  const match = ADVISOR_HEADER_CONFIG.find(({ path }) => pathname === path);
  return match?.config ?? null;
}

export function AdvisorPageHeader(props: AdvisorPageHeaderConfig) {
  const { icon: Icon, kicker, title, subtitle, metadata } = props;
  return (
    <header role="banner" className="advisor-header professional-header">
      <div className="header-icon-section">
        <div className="professional-icon" role="img" aria-label={`${title} section icon`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        {metadata && (
          <div className="hidden sm:block text-center mt-2">
            <time className="professional-timestamp text-xs text-muted-foreground font-medium">
              {metadata.timestamp}
            </time>
          </div>
        )}
      </div>
      <div className="header-content">
        <div className="flex items-center justify-between">
          <p className="professional-kicker" id="advisor-section-context" role="doc-subtitle">
            {kicker}
          </p>
          {metadata && (
            <div className="hidden md:flex items-center gap-3">
              <span className="header-metadata" role="status" aria-label="User role">
                {metadata.userRole}
              </span>
            </div>
          )}
        </div>
        <h1
          className="professional-title text-balance"
          aria-describedby="advisor-section-context advisor-subtitle"
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className="professional-subtitle"
            id="advisor-subtitle"
            role="doc-subtitle"
            aria-label={`Page description: ${subtitle}`}
          >
            {subtitle}
          </p>
        )}
      </div>
    </header>
  );
}

/**
 * Enhanced advisor page header with professional metadata and accessibility features.
 * Renders contextual information appropriate for professional advisory workflows.
 */
export function AdvisorPageHeaderFromPath() {
  const pathname = usePathname();
  const config = getHeaderConfig(pathname);

  if (!config) return null;

  // Add contextual metadata for professional display
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const enhancedConfig = {
    ...config,
    metadata: {
      timestamp: currentDate,
      userRole: 'Advisor',
      pathname: pathname
    }
  };

  return (
    <>
      <AdvisorPageHeader {...enhancedConfig} />
    </>
  );
}
