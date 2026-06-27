"use client";

import type { ClientActionPlanData } from "@/lib/actions/client-action-plan-actions";
import { ExecutiveSummary } from "@/components/action-plan/ExecutiveSummary";
import { TimeHorizonSection } from "@/components/action-plan/TimeHorizonSection";
import { ProgressDashboard } from "@/components/action-plan/ProgressDashboard";

type StrategicActionPlanProps = {
  data: ClientActionPlanData;
};

export function StrategicActionPlan({ data }: StrategicActionPlanProps) {
  const allItems = [...data.immediate, ...data.strategic, ...data.ongoing];

  return (
    <div className="space-y-12">
      {/* 1. Executive Summary */}
      <ExecutiveSummary items={allItems} />

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
    </div>
  );
}
