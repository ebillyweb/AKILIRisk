"use client";

import { Briefcase, ClipboardList, Mail } from "lucide-react";
import type { SubscriptionTier } from "@prisma/client";

import { GatedQuickActionButton } from "@/components/advisor/billing/TierFeatureUpgrade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AdvisorQuickActions({
  subscriptionTier,
}: {
  subscriptionTier: SubscriptionTier;
}) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Quick actions</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <GatedQuickActionButton
          href="/advisor/pipeline?awaitingReview=1"
          label="Intake queue"
          description="Review submitted client intakes"
          icon={ClipboardList}
          currentTier={subscriptionTier}
        />
        <GatedQuickActionButton
          href="/advisor/pipeline?documentsNeeded=1"
          label="Document Requests"
          description="Outstanding mandatory uploads"
          icon={Mail}
          currentTier={subscriptionTier}
        />
        <GatedQuickActionButton
          href="/advisor/engagements"
          label="Engagements"
          description="Accepted recommendations in progress"
          icon={Briefcase}
          currentTier={subscriptionTier}
          feature="IMPLEMENTATION_ENGAGEMENTS"
        />
      </CardContent>
    </Card>
  );
}
