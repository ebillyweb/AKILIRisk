"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import type { CadenceInfo } from "@/lib/cadence/cadence-types";
import {
  overrideCadenceAction,
  setCadenceAction,
} from "@/lib/actions/cadence-actions";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ReviewCadencePanelProps {
  cadence: CadenceInfo | null;
  clientId: string;
  onCadenceUpdated?: () => void;
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Frequency labels
// ---------------------------------------------------------------------------

const FREQUENCY_LABELS: Record<string, string> = {
  ANNUAL: "Annual",
  SEMI_ANNUAL: "Semi-annual",
  QUARTERLY: "Quarterly",
};

type FrequencyKey = "QUARTERLY" | "SEMI_ANNUAL" | "ANNUAL";

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function CadenceStatusBadge({ cadence }: { cadence: CadenceInfo }) {
  switch (cadence.status) {
    case "on_track":
      return (
        <Badge
          variant="secondary"
          className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
        >
          On track
        </Badge>
      );

    case "due_soon":
      return (
        <Badge variant="secondary" className="bg-accent/20 text-accent-foreground">
          Due in {cadence.daysUntilDue} days
        </Badge>
      );

    case "overdue":
      return (
        <Badge
          variant="default"
          className="bg-destructive text-destructive-foreground border-transparent"
        >
          Overdue &mdash; {Math.abs(cadence.daysUntilDue)} days past due
        </Badge>
      );

    case "system_recommended":
      return (
        <Badge variant="secondary" className="bg-accent/20 text-accent-foreground">
          AKILI Recommends
        </Badge>
      );

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Override popover
// ---------------------------------------------------------------------------

function CadenceOverridePopover({
  clientId,
  currentFrequency,
  isNewCadence,
  onUpdated,
}: {
  clientId: string;
  currentFrequency?: string;
  isNewCadence: boolean;
  onUpdated?: () => void;
}) {
  const [frequency, setFrequency] = useState<FrequencyKey>(
    (currentFrequency as FrequencyKey) ?? "ANNUAL",
  );
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const action = isNewCadence ? setCadenceAction : overrideCadenceAction;
      const result = await action({ clientId, frequency });
      if (result.success) {
        setOpen(false);
        onUpdated?.();
      }
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="link" size="sm" className="px-0 h-auto text-xs">
          {isNewCadence ? "Set Cadence" : "Override Cadence"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56" align="start">
        <div className="space-y-3">
          <Select
            value={frequency}
            onValueChange={(v) => setFrequency(v as FrequencyKey)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ANNUAL">Annual</SelectItem>
              <SelectItem value="SEMI_ANNUAL">Semi-annual</SelectItem>
              <SelectItem value="QUARTERLY">Quarterly</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            className="w-full"
            onClick={handleSave}
            disabled={isPending}
          >
            {isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ReviewCadencePanel({
  cadence,
  clientId,
  onCadenceUpdated,
  loading,
}: ReviewCadencePanelProps) {
  // Loading state
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardContent>
      </Card>
    );
  }

  // No cadence configured
  if (!cadence) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Review Cadence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            No review cadence configured
          </p>
          <CadenceOverridePopover
            clientId={clientId}
            isNewCadence
            onUpdated={onCadenceUpdated}
          />
        </CardContent>
      </Card>
    );
  }

  // Populated state
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Review Cadence
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Frequency + override indicator */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {FREQUENCY_LABELS[cadence.frequency] ?? cadence.frequency}
          </span>
          {cadence.isOverridden && (
            <span className="text-xs text-muted-foreground">(Advisor override)</span>
          )}
        </div>

        {/* Status badge */}
        <CadenceStatusBadge cadence={cadence} />

        {/* System recommendation reason */}
        {cadence.systemRecommended && cadence.systemRecommendationReason && (
          <p className="text-xs text-muted-foreground">
            {cadence.systemRecommendationReason}
          </p>
        )}

        {/* Next due date */}
        <div className="text-sm text-muted-foreground">
          Next review:{" "}
          <span className="font-medium text-foreground">
            {format(new Date(cadence.nextDueDate), "MMM d, yyyy")}
          </span>
        </div>

        {/* Override control */}
        <CadenceOverridePopover
          clientId={clientId}
          currentFrequency={cadence.frequency}
          isNewCadence={false}
          onUpdated={onCadenceUpdated}
        />
      </CardContent>
    </Card>
  );
}
