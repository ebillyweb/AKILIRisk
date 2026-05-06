import Link from "next/link";
import { requireAdminRole } from "@/lib/admin/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";

const SECTIONS = [
  { href: "/admin/advisors", label: "Advisors", description: "View and manage advisor accounts and profiles." },
  { href: "/admin/clients", label: "Clients", description: "View and manage client accounts and assignments." },
  {
    href: "/admin/leads",
    label: "Assessment requests",
    description: "Public lead form submissions; assign each request to an advisor.",
  },
  { href: "/admin/intake", label: "Intake Management", description: "Review intake interviews and submission status." },
  {
    href: "/admin/intake/questions",
    label: "Intake script",
    description: "Edit spoken questions for the client audio intake (database pillar rows).",
  },
  { href: "/admin/assessment", label: "Assessment Management", description: "Review assessments and completion status." },
  {
    href: "/admin/question-bank",
    label: "Question bank",
    description: "Six risk areas: edit copy and show/hide assessment questions.",
  },
  { href: "/admin/settings", label: "Settings", description: "Admin and system settings." },
  {
    href: "/admin/scoring/thresholds",
    label: "Risk thresholds",
    description:
      "BRD §4.2 + §7.1: Low / Medium / High score cutoffs. Applies to new scoring runs only.",
  },
  {
    href: "/admin/audit-log",
    label: "Audit log",
    description:
      "BRD §5.4 compliance trail: user activity, configuration changes, and sensitive data-access events. CSV export available.",
  },
  {
    href: "/admin/exports",
    label: "Data exports",
    description:
      "BRD §5.3 data ownership and portability. Per-tenant or system-wide ZIP bundles (CSV + nested JSON + README).",
  },
  {
    href: "/admin/recommendations",
    label: "Recommendations",
    description:
      "BRD §4.4 service catalog + rule editor. Tier (Baseline/Enhanced), complexity, DIY vs Advisory; recommendation engine matches.",
  },
] as const;

export default async function AdminPage() {
  await requireAdminRole();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map(({ href, label, description }) => (
          <Link key={href} href={href}>
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  {label}
                  <ChevronRight className="size-4 text-muted-foreground" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
