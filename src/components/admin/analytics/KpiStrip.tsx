import type { LucideIcon } from "lucide-react";
import {
  Building2,
  ClipboardCheck,
  CreditCard,
  FileCheck,
  Users,
  UsersRound,
} from "lucide-react";
import { formatCount } from "@/components/admin/analytics/MetricCard";
import type { PlatformKpis } from "@/lib/admin/analytics-queries";
import { cn } from "@/lib/utils";

type KpiTileConfig = {
  label: string;
  value: number;
  sub?: string;
  icon: LucideIcon;
  accent: {
    icon: string;
    ring: string;
    bar: string;
  };
};

/**
 * §9.1 (BRD) — top-level KPI strip. Six tiles in a row across the top
 * of /admin/analytics. Pure render; data resolved at the page layer.
 */
export function KpiStrip({ kpis }: { kpis: PlatformKpis }) {
  const enterpriseSub = (() => {
    const parts: string[] = [];
    if (kpis.enterprisesProvisioning > 0) {
      parts.push(`${kpis.enterprisesProvisioning} provisioning`);
    }
    if (kpis.enterprisesSuspended > 0) {
      parts.push(`${kpis.enterprisesSuspended} suspended`);
    }
    return parts.length > 0 ? parts.join(" · ") : undefined;
  })();

  const tiles: KpiTileConfig[] = [
    {
      label: "Active advisors",
      value: kpis.advisorsActive,
      sub:
        kpis.advisorsSoftDeleted > 0
          ? `${kpis.advisorsSoftDeleted} soft-deleted`
          : undefined,
      icon: Users,
      accent: {
        icon: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
        ring: "group-hover:border-sky-500/35 group-hover:bg-sky-500/15",
        bar: "from-sky-500/70 to-sky-500/20",
      },
    },
    {
      label: "Enterprises",
      value: kpis.enterprisesActive,
      sub: enterpriseSub,
      icon: Building2,
      accent: {
        icon: "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300",
        ring: "group-hover:border-violet-500/35 group-hover:bg-violet-500/15",
        bar: "from-violet-500/70 to-violet-500/20",
      },
    },
    {
      label: "Active subscriptions",
      value: kpis.activeSubscriptions,
      sub: "Includes grace period",
      icon: CreditCard,
      accent: {
        icon: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        ring: "group-hover:border-emerald-500/35 group-hover:bg-emerald-500/15",
        bar: "from-emerald-500/70 to-emerald-500/20",
      },
    },
    {
      label: "Active clients",
      value: kpis.clientsActive,
      sub:
        kpis.clientsSoftDeleted > 0
          ? `${kpis.clientsSoftDeleted} soft-deleted`
          : undefined,
      icon: UsersRound,
      accent: {
        icon: "border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-300",
        ring: "group-hover:border-amber-500/35 group-hover:bg-amber-500/15",
        bar: "from-amber-500/70 to-amber-500/20",
      },
    },
    {
      label: "Scored assessments",
      value: kpis.scoredAssessments,
      icon: ClipboardCheck,
      accent: {
        icon: "border-cyan-500/25 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
        ring: "group-hover:border-cyan-500/35 group-hover:bg-cyan-500/15",
        bar: "from-cyan-500/70 to-cyan-500/20",
      },
    },
    {
      label: "Published reports",
      value: kpis.publishedReports,
      sub:
        kpis.draftReports > 0
          ? `${kpis.draftReports} drafts open`
          : undefined,
      icon: FileCheck,
      accent: {
        icon: "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300",
        ring: "group-hover:border-rose-500/35 group-hover:bg-rose-500/15",
        bar: "from-rose-500/70 to-rose-500/20",
      },
    },
  ];

  return (
    <section
      aria-label="Platform KPIs"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6 xl:gap-4"
    >
      {tiles.map((tile) => (
        <KpiTile key={tile.label} {...tile} />
      ))}
    </section>
  );
}

function KpiTile({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: KpiTileConfig) {
  return (
    <article
      className={cn(
        "hero-surface group relative flex min-h-[9.5rem] flex-col rounded-2xl border border-border/80 bg-card p-4 shadow-sm",
        "transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-border hover:shadow-md"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-0.5 rounded-t-2xl bg-gradient-to-r opacity-80",
          accent.bar
        )}
      />

      <div className="space-y-2.5">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl border transition-colors",
            accent.icon,
            accent.ring
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
        <p className="text-sm font-medium leading-snug text-pretty text-foreground">
          {label}
        </p>
      </div>

      <div className="mt-auto flex flex-1 flex-col justify-end gap-1 pt-3">
        <p className="text-2xl font-semibold tabular-nums leading-none tracking-tight text-foreground xl:text-3xl">
          {formatCount(value)}
        </p>
        <div className="min-h-[2rem]">
          {sub ? (
            <p className="text-xs leading-snug text-pretty text-muted-foreground">
              {sub}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
