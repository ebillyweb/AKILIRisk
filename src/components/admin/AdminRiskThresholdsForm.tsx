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

function ThresholdPreview({
  lowMin,
  mediumMin,
  highMin,
}: {
  lowMin: number;
  mediumMin: number;
  highMin: number;
}) {
  return (
    <div className="rounded-md border border-dashed bg-background/60 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        How scores will be labeled
      </p>
      <ul className="mt-2 space-y-1.5 text-sm text-foreground">
        <li>
          <span className="font-medium">Low risk</span> (in good shape) — score{" "}
          {lowMin} to 100
        </li>
        <li>
          <span className="font-medium">Medium risk</span> — score {mediumMin} to{" "}
          {lowMin - 1}
        </li>
        <li>
          <span className="font-medium">High risk</span> — score {highMin} to{" "}
          {mediumMin - 1}
        </li>
        <li>
          <span className="font-medium">Urgent</span> — score below {highMin}
        </li>
      </ul>
    </div>
  );
}

/**
 * Super-admin form for platform-wide score cutoffs (Low / Medium / High / Urgent).
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

  const monotonicityOk = lowMin > mediumMin && mediumMin > highMin;
  const rangeOk = [lowMin, mediumMin, highMin].every(
    (v) => Number.isInteger(v) && v >= 0 && v <= 100
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateRiskThresholds({ lowMin, mediumMin, highMin });
      if (result.success) {
        toast.success("Score cutoffs saved");
        router.refresh();
      } else {
        toast.error(result.error ?? "Save failed");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <p className="text-sm leading-6 text-muted-foreground">
        When a client finishes an assessment, their answers become a score from 0 to
        100 (higher is better). Set the score lines below to decide when results are
        labeled low, medium, high, or urgent — on dashboards, in reports, and when
        advisors review clients.
      </p>

      <div className="space-y-4 rounded-lg border bg-muted/20 p-4 sm:p-5">
        <p className="text-sm font-medium">Score cutoffs</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="lowMin">In good shape (low risk)</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground shrink-0">Score at least</span>
              <Input
                id="lowMin"
                type="number"
                min={0}
                max={100}
                step={1}
                value={lowMin}
                onChange={(e) => setLowMin(Number(e.target.value))}
                disabled={pending}
                className="w-20"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mediumMin">Needs attention (medium)</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground shrink-0">Score at least</span>
              <Input
                id="mediumMin"
                type="number"
                min={0}
                max={100}
                step={1}
                value={mediumMin}
                onChange={(e) => setMediumMin(Number(e.target.value))}
                disabled={pending}
                className="w-20"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="highMin">Concerning (high risk)</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground shrink-0">Score at least</span>
              <Input
                id="highMin"
                type="number"
                min={0}
                max={100}
                step={1}
                value={highMin}
                onChange={(e) => setHighMin(Number(e.target.value))}
                disabled={pending}
                className="w-20"
              />
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Scores below the &ldquo;concerning&rdquo; line are treated as urgent. There is
          no separate field for that — it is everything under the high-risk cutoff.
        </p>

        {monotonicityOk && rangeOk ? (
          <ThresholdPreview lowMin={lowMin} mediumMin={mediumMin} highMin={highMin} />
        ) : null}
      </div>

      <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground space-y-2">
        <p>
          The &ldquo;in good shape&rdquo; number must be highest, then medium, then
          high. For example: 80, 60, 40 (the platform defaults).
        </p>
        <p>
          Changes apply to <strong className="font-medium text-foreground">new</strong>{" "}
          assessments only. Results that were already scored keep their labels until
          the client is assessed again.
        </p>
        {!monotonicityOk && rangeOk && dirty ? (
          <p className="text-destructive">
            Adjust the numbers so each cutoff is lower than the one above it.
          </p>
        ) : null}
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          size="sm"
          disabled={pending || !dirty || !monotonicityOk || !rangeOk}
        >
          {pending ? "Saving…" : "Save cutoffs"}
        </Button>
      </div>
    </form>
  );
}
