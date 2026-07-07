/**
 * BRD §6.3 / Epic 5.10 — Deliverable-phase status banner.
 *
 * Renders a status panel on the client dashboard that adapts to the
 * assessment's `deliverablePhase`. The banner is the client-facing
 * narrative wrapper around the risk heat map:
 *
 *   • PREVIEW  — "Your Risk Preview is ready; outreach within 48 hours."
 *   • PROFILE  — "Your Risk Profile is ready." If any upsell trigger
 *                fired (Section 6.2), append remediation language and an
 *                Accept-the-recommendation call to action.
 *   • PORTFOLIO — "You've engaged the advisory team." Surfaces the
 *                current engagement status and meeting date.
 */

import type { CSSProperties, ReactNode } from "react";
import type { DeliverablePhase, PortfolioEngagementStatus } from "@prisma/client";
import { format } from "date-fns";
import { CheckCircle } from "lucide-react";
import { RiskHeatMap } from "@/components/assessment/RiskHeatMap";
import { Badge } from "@/components/ui/badge";
import { hasFiredUpsellTrigger } from "@/lib/assessment/upsell-triggers";
import {
  formatNarrowScopePreviewCopy,
  isNarrowAssessmentScope,
} from "@/lib/assessment/included-pillars";
import { buildHeatMapCells } from "@/lib/assessment/heat-map-data";
import {
  deliverableBannerSurfaceStyle,
  type DeliverableBannerBrandingProps,
} from "@/lib/client/deliverable-banner-branding";
import type { DeliverableHeatMapData } from "@/lib/client/deliverable-heat-map.server";
import type { PreviewBrandHex } from "@/lib/branding/preview-hex";
import { paletteForRiskLevel } from "@/lib/assessment/risk-color-palette";
import { cn } from "@/lib/utils";
import { AcceptRecommendationButton } from "./AcceptRecommendationButton";

type Props = {
  assessmentId: string;
  phase: DeliverablePhase;
  upsellTriggersFired: readonly string[] | null;
  engagement: {
    status: PortfolioEngagementStatus;
    meetingScheduledAt: Date | null;
    meetingAt: Date | null;
  } | null;
  previewEnteredAt: Date | null;
  profileEnteredAt: Date | null;
  heatMap?: DeliverableHeatMapData | null;
} & Partial<DeliverableBannerBrandingProps>;

function fmtDate(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}

type BannerShellProps = {
  brandHex: PreviewBrandHex | null;
  tone: "primary" | "accent" | "success";
  fallbackClassName: string;
  children: ReactNode;
};

function BannerShell({
  brandHex,
  tone,
  fallbackClassName,
  children,
}: BannerShellProps) {
  const brandedStyle = deliverableBannerSurfaceStyle(brandHex, tone);
  return (
    <div
      className={
        brandedStyle
          ? "rounded-2xl border p-4 sm:p-6"
          : `rounded-2xl border p-4 sm:p-6 ${fallbackClassName}`
      }
      style={brandedStyle}
      role="status"
    >
      {children}
    </div>
  );
}

function mutedTextStyle(brandHex: PreviewBrandHex | null): CSSProperties | undefined {
  if (!brandHex) return undefined;
  return { color: brandHex.primary, opacity: 0.72 };
}

function PreviewBanner({
  previewEnteredAt,
  advisorTeamLabel,
  brandHex,
}: {
  previewEnteredAt: Date | null;
  advisorTeamLabel: string;
  brandHex: PreviewBrandHex | null;
}) {
  return (
    <BannerShell
      brandHex={brandHex}
      tone="primary"
      fallbackClassName="border-blue-200 bg-blue-50 text-blue-900"
    >
      <p className="text-sm font-semibold uppercase tracking-wide">
        Phase 1 · Risk Preview
      </p>
      <h2 className="mt-1 text-xl font-semibold">
        Your Risk Preview is ready
      </h2>
      <p className="mt-2 text-sm leading-relaxed">
        Your questionnaire is complete and a high-level Risk Preview is
        available here. {advisorTeamLabel} is preparing your customized Risk
        Profile and will be in touch within 48 hours.
      </p>
      {previewEnteredAt ? (
        <p className="mt-2 text-xs" style={mutedTextStyle(brandHex)}>
          Preview available since {fmtDate(previewEnteredAt)}.
        </p>
      ) : null}
    </BannerShell>
  );
}

function ProfileBanner({
  assessmentId,
  triggersFired,
  profileEnteredAt,
  advisorTeamLabel,
  brandHex,
}: {
  assessmentId: string;
  triggersFired: boolean;
  profileEnteredAt: Date | null;
  advisorTeamLabel: string;
  brandHex: PreviewBrandHex | null;
}) {
  if (triggersFired) {
    return (
      <BannerShell
        brandHex={brandHex}
        tone="accent"
        fallbackClassName="border-amber-300 bg-amber-50 text-amber-900"
      >
        <p className="text-sm font-semibold uppercase tracking-wide">
          Phase 2 · Risk Profile
        </p>
        <h2 className="mt-1 text-xl font-semibold">
          Significant risk deficiencies identified
        </h2>
        <p className="mt-2 text-sm leading-relaxed">
          Your customized Risk Profile is ready. {advisorTeamLabel} has flagged
          one or more areas where remediation is recommended. Accept the
          recommendation to schedule a meeting and discuss how {advisorTeamLabel}{" "}
          can help close the gaps.
        </p>
        <div className="mt-4">
          <AcceptRecommendationButton assessmentId={assessmentId} />
        </div>
        {profileEnteredAt ? (
          <p className="mt-3 text-xs" style={mutedTextStyle(brandHex)}>
            Profile delivered {fmtDate(profileEnteredAt)}.
          </p>
        ) : null}
      </BannerShell>
    );
  }
  return (
    <BannerShell
      brandHex={brandHex}
      tone="success"
      fallbackClassName="border-emerald-200 bg-emerald-50 text-emerald-900"
    >
      <p className="text-sm font-semibold uppercase tracking-wide">
        Phase 2 · Risk Profile
      </p>
      <h2 className="mt-1 text-xl font-semibold">
        Your Risk Profile is ready
      </h2>
      <p className="mt-2 text-sm leading-relaxed">
        Your customized Risk Profile has been delivered. Review your domain
        scores below.
      </p>
      {profileEnteredAt ? (
        <p className="mt-2 text-xs" style={mutedTextStyle(brandHex)}>
          Profile delivered {fmtDate(profileEnteredAt)}.
        </p>
      ) : null}
    </BannerShell>
  );
}

function PortfolioBanner({
  engagement,
  advisorTeamLabel,
  brandHex,
}: {
  engagement: Props["engagement"];
  advisorTeamLabel: string;
  brandHex: PreviewBrandHex | null;
}) {
  const status = engagement?.status ?? "ACCEPTED";
  const meetingDate = engagement?.meetingAt ?? engagement?.meetingScheduledAt ?? null;

  const statusCopy: Record<PortfolioEngagementStatus, string> = {
    ACCEPTED: `You've accepted the recommendation. ${advisorTeamLabel} will reach out shortly to schedule a meeting.`,
    MEETING_SCHEDULED: meetingDate
      ? `Your meeting with ${advisorTeamLabel} is scheduled for ${fmtDate(meetingDate)}.`
      : `Your meeting with ${advisorTeamLabel} is scheduled.`,
    IN_PROGRESS: `${advisorTeamLabel} is executing your Risk Portfolio. You will be kept updated as work progresses.`,
    COMPLETE: `Your Risk Portfolio engagement is complete. Thank you for working with ${advisorTeamLabel}.`,
    DECLINED: `This engagement was declined. Reach out to ${advisorTeamLabel} if you'd like to revisit the recommendation.`,
  };

  return (
    <BannerShell
      brandHex={brandHex}
      tone="primary"
      fallbackClassName="border-indigo-200 bg-indigo-50 text-indigo-900"
    >
      <p className="text-sm font-semibold uppercase tracking-wide">
        Phase 3 · Risk Portfolio
      </p>
      <h2 className="mt-1 text-xl font-semibold">
        Engaged with {advisorTeamLabel}
      </h2>
      <p className="mt-2 text-sm leading-relaxed">
        {statusCopy[status]}
      </p>
    </BannerShell>
  );
}

function DeliverableAssessmentSection({
  heatMap,
}: {
  heatMap: DeliverableHeatMapData;
}) {
  const cells = buildHeatMapCells(heatMap.pillarScores, {
    catalog: heatMap.catalog,
    includedPillarIds: heatMap.includedPillarIds,
  });

  if (cells.every((cell) => cell.level === "unassessed")) {
    return null;
  }

  const narrowScope = isNarrowAssessmentScope(
    heatMap.includedPillarIds ?? [],
    heatMap.catalog,
  );
  const description = narrowScope && heatMap.includedPillarIds?.length
    ? formatNarrowScopePreviewCopy(heatMap.includedPillarIds, heatMap.catalog)
    : "High-level view of your risk domains from your completed assessment.";
  const riskPalette = heatMap.riskLevel
    ? paletteForRiskLevel(heatMap.riskLevel)
    : null;

  return (
    <div
      className="rounded-xl border border-border/80 bg-background/95 p-4 text-foreground sm:p-5"
      data-testid="deliverable-phase-assessment"
    >
      <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
        <CheckCircle className="size-5 shrink-0" aria-hidden />
        Risk Assessment
      </h3>

      <div className="mt-4 grid grid-cols-2 gap-4 rounded-xl border border-border/80 bg-muted/20 p-4 md:grid-cols-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Status</p>
          <Badge
            variant={heatMap.status === "COMPLETED" ? "success" : "secondary"}
            className="mt-1"
          >
            {heatMap.status === "COMPLETED" ? "Complete" : "In progress"}
          </Badge>
        </div>
        {heatMap.score != null ? (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Risk score</p>
            <p className="mt-1 text-2xl font-semibold leading-none tabular-nums">
              {heatMap.score}
            </p>
          </div>
        ) : null}
        {heatMap.riskLevel ? (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Risk level</p>
            <Badge
              variant="outline"
              className={cn(
                "mt-1 uppercase",
                riskPalette && `${riskPalette.text} ${riskPalette.bg}`,
              )}
            >
              {heatMap.riskLevel}
            </Badge>
          </div>
        ) : null}
        {heatMap.completedAt ? (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Completed</p>
            <p className="mt-1 text-sm">
              {format(heatMap.completedAt, "MMM d, yyyy")}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-5" data-testid="deliverable-phase-heat-map">
        <h4 className="text-sm font-semibold text-foreground">Risk by domain</h4>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">{description}</p>
        <RiskHeatMap
          mode="single-client"
          pillarScores={heatMap.pillarScores}
          includedPillarIds={heatMap.includedPillarIds}
          catalog={heatMap.catalog}
          showUnassessedBanner={false}
        />
      </div>
    </div>
  );
}

export function DeliverablePhaseBanner({
  advisorTeamLabel = "your advisor",
  brandHex = null,
  heatMap = null,
  ...props
}: Props) {
  let phaseBanner: ReactNode;

  if (props.phase === "PREVIEW") {
    phaseBanner = (
      <PreviewBanner
        previewEnteredAt={props.previewEnteredAt}
        advisorTeamLabel={advisorTeamLabel}
        brandHex={brandHex}
      />
    );
  } else if (props.phase === "PROFILE") {
    phaseBanner = (
      <ProfileBanner
        assessmentId={props.assessmentId}
        triggersFired={hasFiredUpsellTrigger(props.upsellTriggersFired)}
        profileEnteredAt={props.profileEnteredAt}
        advisorTeamLabel={advisorTeamLabel}
        brandHex={brandHex}
      />
    );
  } else {
    phaseBanner = (
      <PortfolioBanner
        engagement={props.engagement}
        advisorTeamLabel={advisorTeamLabel}
        brandHex={brandHex}
      />
    );
  }

  return (
    <div className="space-y-4">
      {phaseBanner}
      {heatMap ? <DeliverableAssessmentSection heatMap={heatMap} /> : null}
    </div>
  );
}
