import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowRight,
  ClipboardList,
  Database,
  FileText,
  Settings,
  Shield,
  UserRound,
  Users,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { isSuperAdmin, requireAdminRole } from "@/lib/admin/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const SUPER_ADMIN_ONLY_HREFS = new Set<string>(["/admin/scoring/thresholds"]);

type AdminNavCard = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

type AdminNavGroup = {
  id: string;
  title: string;
  description: string;
  items: readonly AdminNavCard[];
};

const ADMIN_NAV_GROUPS: readonly AdminNavGroup[] = [
  {
    id: "user-management",
    title: "User Management",
    description: "Advisor, client, and internal staff accounts.",
    items: [
      {
        href: "/admin/advisors",
        label: "Advisors",
        description: "View and manage advisor accounts and profiles.",
        icon: Users,
      },
      {
        href: "/admin/clients",
        label: "Clients",
        description: "View and manage client accounts and assignments.",
        icon: UserRound,
      },
      {
        href: "/admin/staff",
        label: "Platform staff",
        description:
          "Admin and super-admin accounts; super admins can promote clients and adjust staff roles.",
        icon: Users,
      },
    ],
  },
  {
    id: "intake-assessments",
    title: "Intake & Assessments",
    description: "Leads, intake content, assessments, and the question bank.",
    items: [
      {
        href: "/admin/leads",
        label: "Assessment requests",
        description: "Public lead form submissions; assign each request to an advisor.",
        icon: ClipboardList,
      },
      {
        href: "/admin/intake",
        label: "Intake Management",
        description: "Review intake interviews and submission status.",
        icon: ClipboardList,
      },
      {
        href: "/admin/intake/questions",
        label: "Intake script",
        description: "Edit spoken questions for the client audio intake (database pillar rows).",
        icon: FileText,
      },
      {
        href: "/admin/assessment",
        label: "Assessment Management",
        description: "Review assessments and completion status.",
        icon: ClipboardList,
      },
      {
        href: "/admin/question-bank",
        label: "Question bank",
        description: "Six risk areas: edit copy and show/hide assessment questions.",
        icon: FileText,
      },
    ],
  },
  {
    id: "platform-operations",
    title: "Platform Operations",
    description: "Configuration, risk policy, compliance, data, and recommendations.",
    items: [
      {
        href: "/admin/settings",
        label: "Settings",
        description: "Admin and system settings.",
        icon: Settings,
      },
      {
        href: "/admin/scoring/thresholds",
        label: "Risk thresholds",
        description: "Low / Medium / High score cutoffs. Applies to new scoring runs only.",
        icon: Shield,
      },
      {
        href: "/admin/audit-log",
        label: "Audit log",
        description:
          "Compliance trail: user activity, configuration changes, and sensitive data-access events. CSV export available.",
        icon: Activity,
      },
      {
        href: "/admin/exports",
        label: "Data exports",
        description:
          "Data ownership and portability. Per-tenant or system-wide ZIP bundles (CSV + nested JSON + README).",
        icon: Database,
      },
      {
        href: "/admin/recommendations",
        label: "Recommendations",
        description:
          "Service catalog and rule editor. Tier (Baseline/Enhanced), complexity, DIY vs Advisory; recommendation engine matches.",
        icon: FileText,
      },
    ],
  },
];

function AdminSectionCard({ href, label, description, icon: Icon }: AdminNavCard) {
  return (
    <Link href={href} className="group block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-xl">
      <Card className="h-full rounded-xl border border-border/80 bg-card shadow-sm transition-all duration-200 ease-out group-hover:-translate-y-0.5 group-hover:border-border group-hover:shadow-md">
        <CardHeader className="space-y-3 pb-2 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-muted-foreground transition-colors group-hover:border-primary/25 group-hover:bg-primary/5 group-hover:text-primary">
                <Icon className="size-4 shrink-0" aria-hidden />
              </span>
              <div className="min-w-0 space-y-1">
                <p className="text-base font-semibold leading-snug tracking-tight text-foreground">{label}</p>
              </div>
            </div>
            <ArrowRight
              className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground"
              aria-hidden
            />
          </div>
        </CardHeader>
        <CardContent className="pb-5 pt-0">
          <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

export default async function AdminPage() {
  await requireAdminRole();
  const session = await auth();
  const superUser = isSuperAdmin(session);

  const visibleGroups = ADMIN_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => superUser || !SUPER_ADMIN_ONLY_HREFS.has(item.href)),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="space-y-10">
      <header className="space-y-4 border-b border-border/60 pb-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">System Administration</h1>
          <Badge variant="secondary" className="font-medium uppercase tracking-wide text-[10px] text-muted-foreground">
            Secure area
          </Badge>
        </div>
        <p className="max-w-3xl text-base leading-relaxed text-muted-foreground">
          Manage users, intake workflows, assessments, configuration, and platform operations.
        </p>
      </header>

      <div className="space-y-12">
        {visibleGroups.map((group) => (
          <section key={group.id} aria-labelledby={`admin-group-${group.id}`} className="space-y-4">
            <div className="space-y-1.5">
              <h2 id={`admin-group-${group.id}`} className="text-lg font-semibold tracking-tight text-foreground">
                {group.title}
              </h2>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{group.description}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((item) => (
                <AdminSectionCard key={item.href} {...item} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
