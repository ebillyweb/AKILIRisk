import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  ListTodo,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type JourneyStepState =
  | "complete"
  | "current"
  | "upcoming"
  | "locked"
  | "waiting";

export type JourneyStep = {
  id: string;
  label: string;
  state: JourneyStepState;
  detail: string;
  href: string;
  disabled?: boolean;
  disabledReason?: string;
};

export type DashboardDestination = {
  id: string;
  title: string;
  description: string;
  href: string;
  statusLabel: string;
  statusVariant: "default" | "secondary" | "success" | "warning" | "outline";
  icon: LucideIcon;
  disabled?: boolean;
  disabledReason?: string;
  cta: string;
};

type Props = {
  headline: string;
  subheadline: string;
  journeySteps: JourneyStep[];
  destinations: DashboardDestination[];
  /** Hides the “Explore your portal” destination grid on white-label dashboards. */
  hideExplorePortalSection?: boolean;
  deliverableBanner?: ReactNode;
};

function journeyStepClasses(state: JourneyStepState): string {
  switch (state) {
    case "complete":
      return "border-primary/30 bg-primary/5 text-foreground";
    case "current":
      return "border-primary bg-primary/10 text-foreground ring-1 ring-primary/20";
    case "waiting":
      return "border-warning/40 bg-warning/5 text-foreground";
    case "locked":
      return "border-border/60 bg-muted/20 text-muted-foreground";
    default:
      return "border-border/60 bg-background/40 text-muted-foreground";
  }
}

function journeyTrackerGridClass(stepCount: number): string {
  if (stepCount <= 1) {
    return "grid gap-3 grid-cols-1";
  }
  if (stepCount === 2) {
    return "grid gap-3 sm:grid-cols-2";
  }
  if (stepCount === 3) {
    return "grid gap-3 sm:grid-cols-2 lg:grid-cols-3";
  }
  return "grid gap-3 sm:grid-cols-2 xl:grid-cols-4";
}

function JourneyTracker({ steps }: { steps: JourneyStep[] }) {
  return (
    <ol
      className={journeyTrackerGridClass(steps.length)}
      aria-label="Assessment journey"
      data-testid="dashboard-journey"
      data-journey-step-count={steps.length}
    >
      {steps.map((step, index) => {
        const inner = (
          <>
            <div className="flex items-center gap-2">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/80 text-xs font-semibold tabular-nums">
                {index + 1}
              </span>
              <p className="text-sm font-semibold">{step.label}</p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {step.detail}
            </p>
          </>
        );

        const className = cn(
          "rounded-xl border px-4 py-3 transition-colors",
          journeyStepClasses(step.state),
          !step.disabled && "hover:border-primary/40 hover:bg-primary/5",
        );

        if (step.disabled) {
          return (
            <li
              key={step.id}
              className={className}
              data-journey-step={step.id}
              data-journey-state={step.state}
              aria-disabled="true"
              title={step.disabledReason ?? "This step is not available yet."}
            >
              {inner}
            </li>
          );
        }

        return (
          <li key={step.id}>
            <Link
              href={step.href}
              className={cn(
                className,
                "block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              )}
              data-journey-step={step.id}
              data-journey-state={step.state}
              data-testid={`dashboard-journey-${step.id}`}
            >
              {inner}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

function DestinationCard({
  destination,
}: {
  destination: DashboardDestination;
}) {
  const Icon = destination.icon;
  const inner = (
    <Card
      className={cn(
        "h-full transition-colors",
        destination.disabled
          ? "opacity-70"
          : "hover:border-primary/30 hover:bg-muted/10"
      )}
    >
      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/30">
            <Icon className="size-5 text-muted-foreground" aria-hidden />
          </div>
          <Badge variant={destination.statusVariant} className="shrink-0">
            {destination.statusLabel}
          </Badge>
        </div>
        <div className="space-y-1">
          <CardTitle className="text-lg">{destination.title}</CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            {destination.description}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {destination.disabled ? (
          <p className="text-xs text-muted-foreground">
            {destination.disabledReason ??
              "This section is not available yet."}
          </p>
        ) : (
          <span className="inline-flex items-center text-sm font-medium text-primary">
            {destination.cta}
            <ArrowRight className="ml-1.5 size-4" aria-hidden />
          </span>
        )}
      </CardContent>
    </Card>
  );

  if (destination.disabled) {
    return (
      <div
        data-testid={`dashboard-destination-${destination.id}`}
        aria-disabled="true"
      >
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={destination.href}
      className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      data-testid={`dashboard-destination-${destination.id}`}
    >
      {inner}
    </Link>
  );
}

export function ClientDashboardOverview({
  headline,
  subheadline,
  journeySteps,
  destinations,
  hideExplorePortalSection = false,
  deliverableBanner,
}: Props) {
  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="hero-surface rounded-[1.75rem] p-4 sm:p-8">
        <div className="space-y-5">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {headline}
            </h2>
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {subheadline}
            </p>
          </div>

          <div className="space-y-3" data-testid="dashboard-journey-section">
            <p className="editorial-kicker">Your journey</p>
            <JourneyTracker steps={journeySteps} />
          </div>

          {deliverableBanner ? (
            <div data-testid="dashboard-deliverable-banner">{deliverableBanner}</div>
          ) : null}
        </div>
      </section>

      {!hideExplorePortalSection ? (
        <section className="space-y-4">
          <div className="space-y-1">
            <p className="editorial-kicker">Where to go next</p>
            <h3 className="text-2xl font-semibold text-foreground">
              Explore your portal
            </h3>
            <p className="max-w-2xl text-sm text-muted-foreground">
              This dashboard is your home base. Open a section below for detailed
              progress, questionnaires, results, and account tools.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {destinations.map((destination) => (
              <DestinationCard key={destination.id} destination={destination} />
            ))}
          </div>
        </section>
      ) : null}

      <section
        className="rounded-[1.25rem] border section-divider bg-muted/20 px-4 py-4 sm:px-5"
        data-testid="dashboard-footer"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <LayoutDashboard
              className="mt-0.5 size-5 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <p className="text-sm leading-relaxed text-muted-foreground">
              Need domain scores, risk domain progress, or downloadable reports?
              Continue in{" "}
              <span className="font-medium text-foreground">
                Personal Risk Profile
              </span>{" "}
              and{" "}
              <span className="font-medium text-foreground">
                Assessment Results
              </span>{" "}
              once those steps are available.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link href="/assessment">
              Open assessment hub
              <ArrowRight className="ml-1.5 size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
