"use client";

import { usePathname } from "next/navigation";
import {
  Users,
  UserCircle,
  Inbox,
  FileText,
  Mic,
  ClipboardCheck,
  ListChecks,
  Settings,
  UserCog,
  Activity,
  BarChart3,
  type LucideIcon,
} from "lucide-react";

export interface AdminPageHeaderConfig {
  icon: LucideIcon;
  kicker: string;
  title: string;
  subtitle?: string;
}

const ADMIN_HEADER_CONFIG: { path: string; config: AdminPageHeaderConfig }[] = [
  {
    path: "/admin/operations",
    config: {
      icon: Activity,
      kicker: "Platform operations",
      title: "Operations health",
      subtitle:
        "Core service health, external dependency status, and recent failures",
    },
  },
  {
    path: "/admin/analytics",
    config: {
      icon: BarChart3,
      kicker: "Business intelligence",
      title: "Executive dashboard",
      subtitle:
        "Aggregate view of advisor, client, assessment, and recommendation activity",
    },
  },
  {
    path: "/admin/advisors",
    config: {
      icon: Users,
      kicker: "User management",
      title: "Advisors",
      subtitle: "Advisor accounts and professional profiles",
    },
  },
  {
    path: "/admin/clients",
    config: {
      icon: UserCircle,
      kicker: "User management",
      title: "Clients",
      subtitle: "Client accounts and advisor assignments",
    },
  },
  {
    path: "/admin/staff",
    config: {
      icon: UserCog,
      kicker: "User management",
      title: "Platform staff",
      subtitle: "Admin and super-admin accounts; role changes are super-admin only",
    },
  },
  {
    path: "/admin/intake/questions",
    config: {
      icon: Mic,
      kicker: "Configuration",
      title: "Intake question bank",
      subtitle:
        "Questions clients hear during the audio intake interview — edit copy, order, and visibility",
    },
  },
  {
    path: "/admin/intake",
    config: {
      icon: FileText,
      kicker: "Assessments",
      title: "Intake management",
      subtitle: "Review client intake interviews and open the live script editor",
    },
  },
  {
    path: "/admin/assessment",
    config: {
      icon: ClipboardCheck,
      kicker: "Assessments",
      title: "Active assessments",
      subtitle: "Governance assessment oversight, progress, and rescore tools",
    },
  },
  {
    path: "/admin/assessment/questions",
    config: {
      icon: ListChecks,
      kicker: "Configuration",
      title: "Assessment question bank",
      subtitle:
        "Governance assessment questions by risk area — edit copy, visibility, and ordering",
    },
  },
  {
    path: "/admin/scoring/thresholds",
    config: {
      icon: Settings,
      kicker: "Configuration",
      title: "Risk-tier thresholds",
      subtitle: "Low, medium, and high cutoffs for resilience scores (super-admin only)",
    },
  },
  {
    path: "/admin/leads",
    config: {
      icon: Inbox,
      kicker: "Assessments",
      title: "Assessment requests",
      subtitle:
        "Public lead form submissions awaiting advisor assignment",
    },
  },
  {
    path: "/admin/settings",
    config: {
      icon: Settings,
      kicker: "System configuration",
      title: "Admin Settings",
      subtitle:
        "Platform configuration and integration management",
    },
  },
];

/** Pages that render their own primary `<h1>` — skip the shared header to avoid duplication. */
const ADMIN_PAGE_HEADER_SKIP_PREFIXES = [
  "/admin/analytics",
  "/admin/operations",
  "/admin/recommendations",
  "/admin/integrations",
  "/admin/exports",
  "/admin/advisors",
  "/admin/clients",
  "/admin/audit-log",
  "/admin/staff",
];

function getHeaderConfig(pathname: string): AdminPageHeaderConfig | null {
  const sorted = [...ADMIN_HEADER_CONFIG].sort((a, b) => b.path.length - a.path.length);
  for (const { path, config } of sorted) {
    if (pathname === path || pathname.startsWith(`${path}/`)) {
      return config;
    }
  }
  return null;
}

export function shouldShowAdminPageHeader(pathname: string): boolean {
  if (pathname === "/admin") return false;
  if (
    ADMIN_PAGE_HEADER_SKIP_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    )
  ) {
    return false;
  }
  return getHeaderConfig(pathname) !== null;
}

export function AdminPageHeader(props: AdminPageHeaderConfig) {
  const { icon: Icon, kicker, title, subtitle } = props;
  return (
    <header role="banner" className="admin-header professional-header space-y-3 sm:space-y-4">
      <div className="flex min-w-0 flex-wrap items-center gap-3 header-section-spacing">
        <div className="professional-icon shrink-0" role="img" aria-label={`${title} section icon`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <p className="professional-kicker min-w-0" id="admin-section-context" role="doc-subtitle">
          {kicker}
        </p>
      </div>
      <div className="header-section-spacing">
        <h1
          className="professional-title text-balance"
          aria-describedby="admin-section-context admin-subtitle"
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className="professional-subtitle"
            id="admin-subtitle"
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
 * Enhanced admin page header with professional accessibility features.
 * Renders the shared admin page header with skip-to-content functionality.
 */
export function AdminPageHeaderFromPath() {
  const pathname = usePathname();
  if (!shouldShowAdminPageHeader(pathname)) return null;
  const config = getHeaderConfig(pathname);
  if (!config) return null;

  return <AdminPageHeader {...config} />;
}
