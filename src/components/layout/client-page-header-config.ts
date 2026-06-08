export type ClientPageHeaderIconName =
  | "layout-dashboard"
  | "file-text"
  | "clipboard-check"
  | "users"
  | "settings";

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
    "Your advisor waived the intake interview — you can begin your governance assessment directly.",
};

const CLIENT_HEADER_CONFIG: { path: string; config: ClientPageHeaderConfig }[] = [
  {
    path: "/dashboard",
    config: {
      icon: "layout-dashboard",
      kicker: "Client Portal",
      title: "Dashboard",
      subtitle:
        "Assessment progress, results, and secure account management",
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
      title: "Governance Assessment",
      subtitle:
        "Comprehensive evaluation of governance structure and family decision-making practices",
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
