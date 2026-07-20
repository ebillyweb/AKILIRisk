"use client";

import { useState, useTransition, useRef } from "react";
import { MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EvidenceAccordion } from "@/components/guidance/EvidenceAccordion";
import { DeferDialog } from "@/components/guidance/DeferDialog";
import { NarrativeReviewPanel } from "@/components/guidance/NarrativeReviewPanel";
import {
  includeInActionPlan,
  deferRecommendation,
  hideFromClient,
  adjustPriority,
  updateAdvisorNotes,
} from "@/lib/actions/guidance-actions";
import type { GuidancePackageItem } from "@/lib/recommendations/types";

type Props = {
  item: GuidancePackageItem;
  selected: boolean;
  onSelect: (id: string, selected: boolean) => void;
  clientName: string;
};

function statusBadgeVariant(
  status: string
): "default" | "secondary" | "outline" | "success" | "warning" {
  switch (status) {
    case "INCLUDED":
      return "success";
    case "IN_PROGRESS":
      return "warning";
    case "COMPLETED":
      return "success";
    case "DEFERRED":
      return "warning";
    case "REVIEWED":
      return "outline";
    case "GENERATED":
    default:
      return "secondary";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "INCLUDED":
      return "In Action Plan";
    case "IN_PROGRESS":
      return "In Progress";
    case "COMPLETED":
      return "Completed";
    case "DEFERRED":
      return "Deferred";
    case "REVIEWED":
      return "Reviewed";
    case "GENERATED":
      return "Generated";
    default:
      return status;
  }
}

function priorityBadgeClasses(priority: string): string {
  switch (priority) {
    case "HIGH":
      return "bg-destructive/10 text-destructive border-destructive/20";
    case "MEDIUM":
      return "bg-trust-accent/15 text-foreground border-trust-accent/30";
    default:
      return "";
  }
}

function resolvePriority(item: GuidancePackageItem): string {
  if (item.advisorPriority) return item.advisorPriority;
  if (item.priority <= 2) return "HIGH";
  if (item.priority <= 4) return "MEDIUM";
  return "LOW";
}

export function RecommendationCard({
  item,
  selected,
  onSelect,
  clientName,
}: Props) {
  const [deferOpen, setDeferOpen] = useState(false);
  const [hideDialogOpen, setHideDialogOpen] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [notesValue, setNotesValue] = useState(item.advisorNotes ?? "");
  const [currentStatus, setCurrentStatus] = useState(item.status);
  const [currentPriority, setCurrentPriority] = useState(resolvePriority(item));
  const [isHidden, setIsHidden] = useState(item.hiddenFromClient);
  const [isPending, startTransition] = useTransition();
  const notesRef = useRef<HTMLTextAreaElement>(null);

  function handleInclude() {
    startTransition(async () => {
      setCurrentStatus("INCLUDED");
      await includeInActionPlan({ recommendationIds: [item.id] });
    });
  }

  async function handleDefer(data: {
    reason: string;
    revisitDate?: string;
    triggerEvent?: string;
    notes?: string;
  }) {
    setCurrentStatus("DEFERRED");
    await deferRecommendation({
      recommendationId: item.id,
      reason: data.reason,
      revisitDate: data.revisitDate,
      triggerEvent: data.triggerEvent,
      notes: data.notes,
    });
  }

  function handleMarkCompleted() {
    startTransition(async () => {
      setCurrentStatus("COMPLETED");
      // Use the server action for status transition
      await includeInActionPlan({ recommendationIds: [item.id] });
      // Then mark as completed via direct transition call if needed
      // For now this triggers the lifecycle transition through includeInActionPlan
    });
  }

  function handleHide() {
    startTransition(async () => {
      setIsHidden(true);
      await hideFromClient({ recommendationId: item.id, hidden: true });
      setHideDialogOpen(false);
    });
  }

  function handlePriorityChange(priority: "HIGH" | "MEDIUM" | "LOW") {
    startTransition(async () => {
      setCurrentPriority(priority);
      await adjustPriority({ recommendationId: item.id, priority });
    });
  }

  function handleNotesBlur() {
    if (notesValue !== (item.advisorNotes ?? "")) {
      startTransition(async () => {
        await updateAdvisorNotes({
          recommendationId: item.id,
          notes: notesValue,
        });
      });
    }
  }

  const priorityDisplay = currentPriority;

  return (
    <>
      <Card
        id={`rec-card-${item.id}`}
        className="border-border/70 shadow-sm"
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-semibold text-foreground">
                  {item.serviceName}
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  {item.category}
                </span>
                <Badge
                  variant={priorityDisplay === "LOW" ? "outline" : "outline"}
                  className={`h-5 text-[10px] ${priorityBadgeClasses(priorityDisplay)}`}
                >
                  {priorityDisplay}
                </Badge>
                {/* Layer attribution badges */}
                <Badge
                  variant="outline"
                  className="h-5 text-[10px] bg-muted text-muted-foreground"
                  aria-label="Source: Platform"
                >
                  Platform
                </Badge>
                {/* Status badge with aria-live for accessibility */}
                <div aria-live="polite" aria-atomic="true">
                  <Badge
                    variant={statusBadgeVariant(currentStatus)}
                    className="h-5 text-[10px]"
                  >
                    {statusLabel(currentStatus)}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="shrink-0 pt-1">
              <Checkbox
                checked={selected}
                onCheckedChange={(checked) =>
                  onSelect(item.id, checked === true)
                }
                aria-label={`Select ${item.serviceName}`}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          {/* Description */}
          <p className="text-sm leading-relaxed text-muted-foreground">
            {item.description}
          </p>

          {/* Evidence Accordion */}
          <EvidenceAccordion
            mergedEvidence={item.mergedEvidence}
            assessmentSources={item.assessmentSources}
          />

          {/* Advisor controls */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
            <Button
              variant="default"
              size="sm"
              className="min-h-9"
              onClick={handleInclude}
              disabled={
                isPending || currentStatus === "INCLUDED" || currentStatus === "COMPLETED"
              }
            >
              Include in Action Plan
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="min-h-9"
              onClick={() => setDeferOpen(true)}
              disabled={isPending || currentStatus === "DEFERRED"}
            >
              Defer
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="min-h-9">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">More actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={handleMarkCompleted}
                  disabled={isPending}
                >
                  Mark Already Addressed
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setHideDialogOpen(true)}
                  disabled={isPending}
                >
                  {isHidden ? "Unhide from Client" : "Hide from Client"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    Adjust Priority
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem
                      onClick={() => handlePriorityChange("HIGH")}
                      disabled={isPending}
                    >
                      High
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handlePriorityChange("MEDIUM")}
                      disabled={isPending}
                    >
                      Medium
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handlePriorityChange("LOW")}
                      disabled={isPending}
                    >
                      Low
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Advisor notes */}
          <div className="pt-1">
            {notesExpanded ? (
              <Textarea
                ref={notesRef}
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                onBlur={handleNotesBlur}
                placeholder="Add advisor notes..."
                rows={3}
                className="text-sm"
                autoFocus
              />
            ) : (
              <button
                type="button"
                className="w-full text-left text-sm text-muted-foreground hover:text-foreground border border-transparent hover:border-border/60 rounded-md px-3 py-2 transition-colors"
                onClick={() => setNotesExpanded(true)}
              >
                {notesValue
                  ? notesValue
                  : "Add advisor notes..."}
              </button>
            )}
          </div>

          {/* AI-drafted narrative — advisor review + approve (Phase 4) */}
          <NarrativeReviewPanel item={item} />
        </CardContent>
      </Card>

      {/* Defer Dialog */}
      <DeferDialog
        open={deferOpen}
        onOpenChange={setDeferOpen}
        onDefer={handleDefer}
      />

      {/* Hide from Client confirmation dialog */}
      <Dialog open={hideDialogOpen} onOpenChange={setHideDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hide from client?</DialogTitle>
            <DialogDescription>
              This recommendation will not appear in {clientName}&apos;s
              Strategic Action Plan. You can unhide it from the guidance package
              at any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setHideDialogOpen(false)}
              disabled={isPending}
            >
              Keep visible
            </Button>
            <Button
              variant="destructive"
              onClick={handleHide}
              disabled={isPending}
            >
              {isPending ? "Hiding..." : "Yes, hide from client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
