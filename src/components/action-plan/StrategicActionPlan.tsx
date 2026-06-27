"use client";

import type { ClientActionPlanData, TrackingContext } from "@/lib/actions/client-action-plan-actions";
import { ExecutiveSummary } from "@/components/action-plan/ExecutiveSummary";
import { TimeHorizonSection } from "@/components/action-plan/TimeHorizonSection";
import { ProgressDashboard } from "@/components/action-plan/ProgressDashboard";
import { NextStepCallout } from "@/components/action-plan/NextStepCallout";
import { ActivityFeed } from "@/components/action-plan/ActivityFeed";

type StrategicActionPlanProps = {
  data: ClientActionPlanData;
  trackingContext?: TrackingContext;
};

export function StrategicActionPlan({ data, trackingContext }: StrategicActionPlanProps) {
  const allItems = [...data.immediate, ...data.strategic, ...data.ongoing];
  const isTrackingActive = trackingContext?.isTrackingActive ?? false;

  return (
    <div className="space-y-12">
      {/* 1. Executive Summary */}
      <ExecutiveSummary items={allItems} />

      {/* Next Step Callout (only when tracking is active, per D-09) */}
      {isTrackingActive && trackingContext && trackingContext.allMilestones.length > 0 && (
        <NextStepCallout milestones={trackingContext.allMilestones} />
      )}

      {/* 2. Immediate Priorities (0-90 days) */}
      <TimeHorizonSection
        heading="Immediate Priorities"
        subhead="Actions to complete in the next 90 days"
        items={data.immediate}
        horizon="immediate"
      />

      {/* 3. Strategic Initiatives (3-12 months) */}
      <TimeHorizonSection
        heading="Strategic Initiatives"
        subhead="Longer-horizon programs (3-12 months)"
        items={data.strategic}
        horizon="strategic"
      />

      {/* 4. Ongoing Practices */}
      <TimeHorizonSection
        heading="Ongoing Practices"
        items={data.ongoing}
        horizon="ongoing"
      />

      {/* 5. Progress Dashboard */}
      <ProgressDashboard items={allItems} />

      {/* 6. Activity Feed (only when tracking is active, per D-06) */}
      {isTrackingActive && trackingContext && (
        <ActivityFeed activities={trackingContext.activities} />
      )}
    </div>
  );
}
