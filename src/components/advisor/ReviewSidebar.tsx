"use client";

import { useState, useEffect } from "react";
import { Users } from "lucide-react";
import { RiskAreaSelector } from "./RiskAreaSelector";
import { ApprovalActions } from "./ApprovalActions";
import type { IntakeReviewData } from "@/lib/advisor/types";

interface ReviewSidebarProps {
  interviewId: string;
  approval: IntakeReviewData["approval"];
  householdProfileCount: number;
}

export function ReviewSidebar({
  interviewId,
  approval,
  householdProfileCount,
}: ReviewSidebarProps) {
  const [selectedAreas, setSelectedAreas] = useState<string[]>(
    approval?.focusAreas || []
  );
  const [notes, setNotes] = useState(approval?.notes || "");

  useEffect(() => {
    queueMicrotask(() => {
      setSelectedAreas(approval?.focusAreas || []);
      setNotes(approval?.notes || "");
    });
  }, [approval]);

  return (
    <div className="space-y-8">
      <div className="flex gap-3 rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
        <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 space-y-0.5 text-sm">
          <p className="font-medium text-foreground">Household directory</p>
          {householdProfileCount > 0 ? (
            <p className="leading-relaxed text-muted-foreground">
              <a
                href="#household-directory"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                {householdProfileCount}{" "}
                {householdProfileCount === 1 ? "profile" : "profiles"}
              </a>
              <span> in the main column.</span>
            </p>
          ) : (
            <p className="text-muted-foreground">
              No household profiles on file yet.
            </p>
          )}
          {householdProfileCount > 0 ? (
            <p className="text-xs text-muted-foreground lg:hidden">
              On mobile, open &quot;Household directory&quot; in the main column
              to expand.
            </p>
          ) : null}
        </div>
      </div>

      <RiskAreaSelector
        selectedAreas={selectedAreas}
        onChange={setSelectedAreas}
        disabled={
          approval?.status === "APPROVED" || approval?.status === "REJECTED"
        }
      />

      <div className="border-t border-border/80 pt-6">
        <ApprovalActions
          interviewId={interviewId}
          approvalId={approval?.id}
          currentStatus={approval?.status}
          selectedFocusAreas={selectedAreas}
          notes={notes}
          onNotesChange={setNotes}
          disabled={false}
        />
      </div>
    </div>
  );
}
