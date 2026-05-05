"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

import { updateRiskThresholds } from "@/lib/admin/platform-settings-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AdminRiskThresholdsFormProps {
  initialLowMin: number;
  initialMediumMin: number;
  initialHighMin: number;
}

/**
 * A2 (BRD §4.2 + §7.1): admin form for the three configurable risk-tier
 * cutoffs.
 *
 * Three integer inputs (Low, Medium, High). Server-side validates strict
 * monotonicity (low > medium > high) and the [0, 100] range. The fourth
 * "critical" band is implicit — anything below the High cutoff falls there
 * — explained in the form's helper text so admins don't expect a fourth
 * input.
 */
export function AdminRiskThresholdsForm({
  initialLowMin,
  initialMediumMin,
  initialHighMin,
}: AdminRiskThresholdsFormProps) {
  const router = useRouter();
  const [lowMin, setLowMin] = useState(initialLowMin);
  const [mediumMin, setMediumMin] = useState(initialMediumMin);
  const [highMin, setHighMin] = useState(initialHighMin);
  const [pending, startTransition] = useTransition();

  const dirty =
    lowMin !== initialLowMin ||
    mediumMin !== initialMediumMin ||
    highMin !== initialHighMin;

  // Client-side hint for the monotonicity rule. Server still validates;
  // this just keeps the Save button disabled when the input is obviously
  // bad so the user gets immediate feedback.
  const monotonicityOk = lowMin > mediumMin && mediumMin > highMin;
  const rangeOk =
    [lowMin, mediumMin, highMin].every(
      (v) => Number.isInteger(v) && v >= 0 && v <= 100
    );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateRiskThresholds({ lowMin, mediumMin, highMin });
      if (result.success) {
        toast.success("Risk thresholds saved");
        router.refresh();
      } else {
        toast.error(result.error ?? "Save failed");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="lowMin">Low (resilient) ≥</Label>
          <Input
            id="lowMin"
            type="number"
            min={0}
            max={100}
            step={1}
            value={lowMin}
            onChange={(e) => setLowMin(Number(e.target.value))}
            disabled={pending}
          />
          <p className="text-xs text-muted-foreground">% resilience</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mediumMin">Medium (moderate) ≥</Label>
          <Input
            id="mediumMin"
            type="number"
            min={0}
            max={100}
            step={1}
            value={mediumMin}
            onChange={(e) => setMediumMin(Number(e.target.value))}
            disabled={pending}
          />
          <p className="text-xs text-muted-foreground">% resilience</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="highMin">High (elevated) ≥</Label>
          <Input
            id="highMin"
            type="number"
            min={0}
            max={100}
            step={1}
            value={highMin}
            onChange={(e) => setHighMin(Number(e.target.value))}
            disabled={pending}
          />
          <p className="text-xs text-muted-foreground">% resilience</p>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
        <p>
          Below the High cutoff is treated as <strong>Critical</strong> risk in internal scoring.
          User-facing reports group Critical with High where appropriate.
        </p>
        <p>
          Threshold changes apply to <strong>new scoring runs only</strong>. Previously scored
          assessments retain their stored risk level until they are re-scored.
        </p>
        {!monotonicityOk && rangeOk && dirty ? (
          <p className="text-destructive">
            Thresholds must be strictly decreasing: Low &gt; Medium &gt; High.
          </p>
        ) : null}
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          size="sm"
          disabled={pending || !dirty || !monotonicityOk || !rangeOk}
        >
          {pending ? "Saving…" : "Save thresholds"}
        </Button>
      </div>
    </form>
  );
}
