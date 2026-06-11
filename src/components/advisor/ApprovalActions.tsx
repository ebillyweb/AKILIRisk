"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
import { toast } from "react-hot-toast";
import {
  markIntakeInReview,
  approveClientIntake,
  rejectClientIntake,
} from "@/lib/actions/advisor-actions";

interface ApprovalActionsProps {
  interviewId: string;
  approvalId?: string;
  currentStatus?: string;
  selectedIncludedPillars: string[];
  selectedEmphasisAreas: string[];
  notes: string;
  onNotesChange: (notes: string) => void;
  disabled?: boolean;
}

export function ApprovalActions({
  interviewId,
  approvalId,
  currentStatus,
  selectedIncludedPillars,
  selectedEmphasisAreas,
  notes,
  onNotesChange,
  disabled = false
}: ApprovalActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [showConfirmation, setShowConfirmation] = useState<'approve' | 'reject' | null>(null);

  const handleBeginReview = async () => {
    startTransition(async () => {
      try {
        const result = await markIntakeInReview(interviewId);
        if (result.success) {
          toast.success("Review started");
        } else {
          toast.error(result.error || "Failed to start review");
        }
      } catch (error) {
        toast.error("Failed to start review");
      }
    });
  };

  const handleApprove = async () => {
    if (selectedIncludedPillars.length === 0) {
      toast.error("Please select at least one assessment domain before approving");
      return;
    }

    startTransition(async () => {
      try {
        const result = await approveClientIntake({
          interviewId,
          includedPillars: selectedIncludedPillars,
          focusAreas:
            selectedEmphasisAreas.length > 0 ? selectedEmphasisAreas : undefined,
          notes: notes.trim() || undefined,
        });

        if (result.success) {
          toast.success("Client approved for assessment");
          setShowConfirmation(null);
        } else {
          toast.error(result.error || "Failed to approve client");
        }
      } catch (error) {
        toast.error("Failed to approve client");
      }
    });
  };

  const handleReject = async () => {
    if (!approvalId) {
      toast.error("Cannot reject - no approval record found");
      return;
    }

    startTransition(async () => {
      try {
        const result = await rejectClientIntake(approvalId, notes.trim() || undefined);

        if (result.success) {
          toast.success("Client intake rejected");
          setShowConfirmation(null);
        } else {
          toast.error(result.error || "Failed to reject client");
        }
      } catch (error) {
        toast.error("Failed to reject client");
      }
    });
  };

  const handleRevokeApproval = async () => {
    if (!approvalId) return;

    startTransition(async () => {
      try {
        const result = await markIntakeInReview(interviewId);
        if (result.success) {
          toast.success("Approval revoked - back to review");
        } else {
          toast.error(result.error || "Failed to revoke approval");
        }
      } catch (error) {
        toast.error("Failed to revoke approval");
      }
    });
  };

  const handleReopenFromReject = async () => {
    startTransition(async () => {
      try {
        const result = await markIntakeInReview(interviewId);
        if (result.success) {
          toast.success("Intake reopened for review");
        } else {
          toast.error(result.error || "Failed to reopen intake");
        }
      } catch (error) {
        toast.error("Failed to reopen intake");
      }
    });
  };

  const notesDisabled =
    disabled || currentStatus === "APPROVED" || currentStatus === "REJECTED";

  // Render confirmation dialog
  if (showConfirmation) {
    const isApprove = showConfirmation === "approve";

    return (
      <section
        className="space-y-4 rounded-lg border border-border/80 bg-muted/25 p-4"
        aria-labelledby="review-confirm-heading"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <AlertCircle
              className="h-4 w-4 shrink-0 text-amber-600"
              aria-hidden
            />
            <h3
              id="review-confirm-heading"
              className="text-sm font-semibold text-foreground"
            >
              {isApprove ? "Confirm approval" : "Confirm rejection"}
            </h3>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {isApprove
              ? `Approve this client for an assessment across ${selectedIncludedPillars.length} selected ${selectedIncludedPillars.length === 1 ? "domain" : "domains"}. They can begin once you confirm.`
              : "Reject this intake. The client will need to resubmit before you can review again."}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            onClick={isApprove ? handleApprove : handleReject}
            variant={isApprove ? "default" : "destructive"}
            disabled={isPending || disabled}
            className="w-full"
          >
            {isApprove ? "Confirm approval" : "Confirm rejection"}
          </Button>
          <Button
            onClick={() => setShowConfirmation(null)}
            variant="outline"
            disabled={isPending}
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status-specific actions */}
      {(!currentStatus || currentStatus === "PENDING") && (
        <section className="space-y-3" aria-labelledby="review-pending-heading">
          <h3
            id="review-pending-heading"
            className="text-base font-semibold tracking-tight"
          >
            Start review
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Open the intake for review to select assessment domains and approve or
            reject.
          </p>
          <Button
            onClick={handleBeginReview}
            disabled={isPending || disabled}
            className="w-full"
          >
            <Clock className="mr-2 h-4 w-4" />
            Begin review
          </Button>
        </section>
      )}

      {currentStatus === "IN_REVIEW" && (
        <section className="space-y-3" aria-labelledby="review-decision-heading">
          <h3
            id="review-decision-heading"
            className="text-base font-semibold tracking-tight"
          >
            Decision
          </h3>

          <div className="flex flex-col gap-2">
            <Button
              onClick={() => setShowConfirmation("approve")}
              disabled={isPending || disabled || selectedIncludedPillars.length === 0}
              className="h-auto w-full whitespace-normal py-2.5"
            >
              <CheckCircle2 className="mr-2 h-4 w-4 shrink-0" />
              Approve for assessment
            </Button>
            <Button
              onClick={() => setShowConfirmation("reject")}
              disabled={isPending || disabled}
              variant="outline"
              className="h-auto w-full border-destructive/30 py-2.5 text-destructive hover:bg-destructive/5 hover:text-destructive"
            >
              <XCircle className="mr-2 h-4 w-4 shrink-0" />
              Reject
            </Button>
          </div>

          {selectedIncludedPillars.length === 0 ? (
            <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
              <AlertCircle
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600"
                aria-hidden
              />
              Select at least one assessment domain above to enable approval.
            </p>
          ) : null}
        </section>
      )}

      {currentStatus === "APPROVED" && (
        <section className="space-y-3" aria-labelledby="review-approved-heading">
          <h3
            id="review-approved-heading"
            className="text-base font-semibold tracking-tight"
          >
            Approved
          </h3>
          <div className="space-y-2">
            <Badge variant="success" className="inline-flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Assessment unlocked
            </Badge>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Client can begin their assessment (
              {selectedIncludedPillars.length}{" "}
              {selectedIncludedPillars.length === 1 ? "domain" : "domains"} selected).
            </p>
          </div>
          <Button
            onClick={handleRevokeApproval}
            disabled={isPending || disabled}
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
          >
            Revoke approval
          </Button>
        </section>
      )}

      {currentStatus === "REJECTED" && (
        <section className="space-y-3" aria-labelledby="review-rejected-heading">
          <h3
            id="review-rejected-heading"
            className="text-base font-semibold tracking-tight"
          >
            Rejected
          </h3>
          <div className="space-y-2">
            <Badge variant="warning" className="inline-flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              Intake rejected
            </Badge>
            <p className="text-sm leading-relaxed text-muted-foreground">
              The client must resubmit before this intake can be reviewed again.
            </p>
          </div>
          <Button
            onClick={handleReopenFromReject}
            disabled={isPending || disabled}
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
          >
            Reopen for review
          </Button>
        </section>
      )}

      <section className="space-y-2" aria-labelledby="review-notes-heading">
        <div className="space-y-0.5">
          <h3
            id="review-notes-heading"
            className="text-sm font-medium text-foreground"
          >
            Review notes
          </h3>
          <p className="text-xs text-muted-foreground">Optional — visible to your team.</p>
        </div>
        <Textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Context for this review, follow-ups, or rejection reason…"
          className="min-h-[4.5rem] resize-none text-sm"
          disabled={notesDisabled}
        />
      </section>
    </div>
  );
}