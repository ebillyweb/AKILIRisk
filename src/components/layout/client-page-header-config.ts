export type ClientPageHeaderIconName =
  | "layout-dashboard"
  | "file-text"
  | "clipboard-check"
  | "users"
  | "settings"
  | "life-buoy";

export interface ClientPageHeaderConfig {
  icon: ClientPageHeaderIconName;
  kicker: string;
  title: string;
  subtitle?: string;
}

const INTAKE_WAIVED_HEADER_CONFIG: ClientPageHeaderConfig = {
  icon: "file-text",
  kicker: "Family Assessment",
  title: "Intake not required",
  subtitle:
    "Your advisor waived the intake interview — you can begin your personal risk profile directly.",
};

const CLIENT_HEADER_CONFIG: { path: string; config: ClientPageHeaderConfig }[] = [
  {
    path: "/dashboard",
    config: {
      icon: "layout-dashboard",
      kicker: "Client Portal",
      title: "Dashboard",
      subtitle:
        "Your home base for intake status, next steps, and links to detailed work areas",
    },
  },
  {
    path: "/intake",
    config: {
      icon: "file-text",
      kicker: "Family Assessment",
      title: "Family Governance Intake",
      subtitle:
        "Confidential family governance intake interview",
    },
  },
  {
    path: "/assessment",
    config: {
      icon: "clipboard-check",
      kicker: "Family Assessment",
      title: "Personal Risk Profile",
      subtitle:
        "Comprehensive evaluation of governance structure and family decision-making practices",
    },
  },
  {
    path: "/documents",
    config: {
      icon: "file-text",
      kicker: "Document collection",
      title: "Documents",
      subtitle:
        "Upload requested files and track what your advisor still needs from you",
    },
  },
  {
    path: "/profiles",
    config: {
      icon: "users",
      kicker: "Family Structure",
      title: "Household Profiles",
      subtitle:
        "Family member profiles and governance participation roles",
    },
  },
  {
    path: "/settings",
    config: {
      icon: "settings",
      kicker: "Account Security",
      title: "Security & Access",
      subtitle:
        "Account identity verification and multi-factor authentication",
    },
  },
  {
    path: "/support",
    config: {
      icon: "life-buoy",
      kicker: "Help Center",
      title: "Support",
      subtitle: "Submit a ticket for account, billing, or technical help",
    },
  },
];

function getHeaderConfig(pathname: string): ClientPageHeaderConfig | null {
  const match = CLIENT_HEADER_CONFIG.find(
    ({ path }) => pathname === path || pathname.startsWith(`${path}/`),
  );
  return match?.config ?? null;
}

export type ClientPageHeaderOptions = {
  /** When true on `/intake`, show waived copy instead of the interview intro. */
  intakeWaivedOnLanding?: boolean;
};

export function getClientPageHeaderConfig(
  pathname: string,
  options?: ClientPageHeaderOptions,
): ClientPageHeaderConfig | null {
  if (options?.intakeWaivedOnLanding && pathname === "/intake") {
    return INTAKE_WAIVED_HEADER_CONFIG;
  }
  return getHeaderConfig(pathname);
}
