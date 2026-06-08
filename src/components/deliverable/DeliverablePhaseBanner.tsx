/**
 * BRD §6.3 / Epic 5.10 — Deliverable-phase status banner.
 *
 * Renders a single status panel at the top of the client dashboard that
 * adapts to the assessment's `deliverablePhase`. The banner is the
 * client-facing narrative wrapper around the existing heat map:
 *
 *   • PREVIEW  — "Your Risk Preview is ready; outreach within 48 hours."
 *   • PROFILE  — "Your Risk Profile is ready." If any upsell trigger
 *                fired (Section 6.2), append remediation language and an
 *                Accept-the-recommendation call to action.
 *   • PORTFOLIO — "You've engaged the advisory team." Surfaces the
 *                current engagement status and meeting date.
 *
 * The component is a server component so it can read the engagement row
 * directly; the Accept action itself is wired through a small client
 * component (`AcceptRecommendationButton`).
 */

import type { DeliverablePhase, PortfolioEngagementStatus } from "@prisma/client";
import { hasFiredUpsellTrigger } from "@/lib/assessment/upsell-triggers";
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
};

function fmtDate(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}

function PreviewBanner({ previewEnteredAt }: { previewEnteredAt: Date | null }) {
  return (
    <div
      className="rounded-2xl border border-blue-200 bg-blue-50 p-4 sm:p-6"
      role="status"
    >
      <p className="text-sm font-semibold uppercase tracking-wide text-blue-900">
        Phase 1 · Risk Preview
      </p>
      <h2 className="mt-1 text-xl font-semibold text-blue-950">
        Your Risk Preview is ready
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-blue-900">
        Your questionnaire is complete and a high-level Risk Preview is
        viewable below. The advisory team is preparing your customized Risk
        Profile and will be in touch within 48 hours.
      </p>
      {previewEnteredAt ? (
        <p className="mt-2 text-xs text-blue-800/70">
          Preview available since {fmtDate(previewEnteredAt)}.
        </p>
      ) : null}
    </div>
  );
}

function ProfileBanner({
  assessmentId,
  triggersFired,
  profileEnteredAt,
}: {
  assessmentId: string;
  triggersFired: boolean;
  profileEnteredAt: Date | null;
}) {
  if (triggersFired) {
    return (
      <div
        className="rounded-2xl border border-amber-300 bg-amber-50 p-4 sm:p-6"
        role="status"
      >
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-900">
          Phase 2 · Risk Profile
        </p>
        <h2 className="mt-1 text-xl font-semibold text-amber-950">
          Significant risk deficiencies identified
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-amber-900">
          Your customized Risk Profile is ready. The advisory team has flagged
          one or more areas where remediation is recommended. Accept the
          recommendation to schedule a meeting and discuss how AKILI Risk
          Intelligence can help close the gaps.
        </p>
        <div className="mt-4">
          <AcceptRecommendationButton assessmentId={assessmentId} />
        </div>
        {profileEnteredAt ? (
          <p className="mt-3 text-xs text-amber-800/70">
            Profile delivered {fmtDate(profileEnteredAt)}.
          </p>
        ) : null}
      </div>
    );
  }
  return (
    <div
      className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-6"
      role="status"
    >
      <p className="text-sm font-semibold uppercase tracking-wide text-emerald-900">
        Phase 2 · Risk Profile
      </p>
      <h2 className="mt-1 text-xl font-semibold text-emerald-950">
        Your Risk Profile is ready
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-emerald-900">
        Your customized Risk Profile has been delivered. View the detailed
        results below.
      </p>
      {profileEnteredAt ? (
        <p className="mt-2 text-xs text-emerald-800/70">
          Profile delivered {fmtDate(profileEnteredAt)}.
        </p>
      ) : null}
    </div>
  );
}

function PortfolioBanner({
  engagement,
}: {
  engagement: Props["engagement"];
}) {
  const status = engagement?.status ?? "ACCEPTED";
  const meetingDate = engagement?.meetingAt ?? engagement?.meetingScheduledAt ?? null;

  const statusCopy: Record<PortfolioEngagementStatus, string> = {
    ACCEPTED:
      "You've accepted the recommendation. Your advisor will reach out shortly to schedule a meeting.",
    MEETING_SCHEDULED: meetingDate
      ? `Your meeting with the advisory team is scheduled for ${fmtDate(meetingDate)}.`
      : "Your meeting with the advisory team is scheduled.",
    IN_PROGRESS:
      "The advisory team is executing your Risk Portfolio. Your advisor will keep you updated as work progresses.",
    COMPLETE:
      "Your Risk Portfolio engagement is complete. Thank you for working with the advisory team.",
    DECLINED:
      "This engagement was declined. Reach out to your advisor if you'd like to revisit the recommendation.",
  };

  return (
    <div
      className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 sm:p-6"
      role="status"
    >
      <p className="text-sm font-semibold uppercase tracking-wide text-indigo-900">
        Phase 3 · Risk Portfolio
      </p>
      <h2 className="mt-1 text-xl font-semibold text-indigo-950">
        Engaged with the advisory team
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-indigo-900">
        {statusCopy[status]}
      </p>
    </div>
  );
}

export function DeliverablePhaseBanner(props: Props) {
  if (props.phase === "PREVIEW") {
    return <PreviewBanner previewEnteredAt={props.previewEnteredAt} />;
  }
  if (props.phase === "PROFILE") {
    return (
      <ProfileBanner
        assessmentId={props.assessmentId}
        triggersFired={hasFiredUpsellTrigger(props.upsellTriggersFired)}
        profileEnteredAt={props.profileEnteredAt}
      />
    );
  }
  return <PortfolioBanner engagement={props.engagement} />;
}
