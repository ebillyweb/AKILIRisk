import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  formatCount,
  formatPercent,
} from "@/components/admin/analytics/MetricCard";
import type { OnboardingFunnel } from "@/lib/admin/analytics-metrics";

/**
 * Onboarding funnel: a horizontal stepper that reads
 *
 *     created → billed → has client → has submitted intake
 *
 * Each step shows the absolute count and the conversion from the
 * previous step. Conversions are honest: when the previous step is 0
 * we render "—" not "0%".
 */
export function FunnelSummary({ funnel }: { funnel: OnboardingFunnel }) {
  const steps: Array<{ label: string; count: number; sub?: string }> = [
    {
      label: "Advisors created",
      count: funnel.newAdvisors30d,
      sub: "Last 30 days",
    },
    {
      label: "Active",
      count: funnel.activeAdvisors,
      sub: "Portal enabled, not soft-deleted",
    },
    {
      label: "Billed",
      count: funnel.advisorsWithSubscription,
      sub: "Active or grace-period subscription",
    },
    {
      label: "Has client",
      count: funnel.advisorsWithClient,
      sub: "≥ 1 active assignment",
    },
    {
      label: "Intake in",
      count: funnel.advisorsWithSubmittedIntake,
      sub: "Client submitted intake",
    },
  ];

  return (
    <Card className="border-border/80">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold tracking-tight">
          Advisor onboarding funnel
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Where advisors fall off between sign-up and getting a client through
          intake. Completion rate today:{" "}
          <span className="font-semibold text-foreground">
            {formatPercent(funnel.completionRate, 0)}
          </span>
          {funnel.completionRate === null ? (
            <span> — not enough data yet.</span>
          ) : null}
        </p>
      </CardHeader>
      <CardContent>
        <ol
          role="list"
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
        >
          {steps.map((step, idx) => {
            const previous = idx === 0 ? null : steps[idx - 1].count;
            const conversion =
              previous && previous > 0 ? step.count / previous : null;
            return (
              <li
                key={step.label}
                className={cn(
                  "rounded-xl border border-border/70 bg-card/60 p-4",
                  "flex flex-col gap-1"
                )}
              >
                <p className="editorial-kicker text-[0.65rem]">{step.label}</p>
                <p className="text-2xl font-semibold tabular-nums leading-tight">
                  {formatCount(step.count)}
                </p>
                {step.sub ? (
                  <p className="text-[0.7rem] text-muted-foreground">
                    {step.sub}
                  </p>
                ) : null}
                {idx > 0 ? (
                  <p className="mt-1 text-[0.65rem] text-muted-foreground">
                    {conversion === null
                      ? "— vs previous"
                      : `${formatPercent(conversion, 0)} of previous`}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
