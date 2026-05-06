"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { rescoreAssessment } from "@/lib/actions/admin-rescore-actions";
import { Button } from "@/components/ui/button";

interface Props {
  assessmentId: string;
}

/**
 * C2 (BRD §7.2): "Rescore" button on the admin assessment list.
 *
 * Two-step UX: button opens an inline confirmation panel with a required
 * reason prompt (typed-but-optional in Zod; the form prompts for it
 * because rescoring is destructive — overwrites prior PillarScore +
 * AssessmentRecommendation rows). Submit is labeled "Rescore now" with
 * destructive styling.
 *
 * The audit row is written by the server action regardless of outcome
 * (success or rollback) — see admin-rescore-actions.ts:rescoreAssessment.
 */
export function AssessmentRescoreButton({ assessmentId }: Props) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ newVersion: number; pillarsChanged: number; recommendationsCount: number } | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await rescoreAssessment({
        assessmentId,
        reason: reason.trim() || undefined,
      });
      if (result.success) {
        setDone({
          newVersion: result.data.newVersion,
          pillarsChanged: result.data.pillarsChanged,
          recommendationsCount: result.data.recommendationsCount,
        });
        setConfirmOpen(false);
        setReason("");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  if (done) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-emerald-900">
          Rescored to v{done.newVersion} · {done.pillarsChanged} pillars · {done.recommendationsCount} recs
        </span>
        <Link
          href={`/admin/audit-log/entity/Assessment/${assessmentId}`}
          className="text-muted-foreground hover:text-foreground hover:underline"
        >
          History
        </Link>
      </div>
    );
  }

  if (!confirmOpen) {
    return (
      <div className="flex items-center gap-3">
        <Link
          href={`/admin/audit-log/entity/Assessment/${assessmentId}`}
          className="text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          View history
        </Link>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          onClick={() => setConfirmOpen(true)}
        >
          Rescore
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-2 max-w-md">
      <p className="text-xs text-amber-900">
        Rescoring overwrites the assessment&apos;s pillar scores and
        recommendations using the current rules + thresholds. The prior
        state is captured in the audit log.
      </p>
      <label className="block text-xs font-medium text-amber-900">
        Optional: why are you rescoring this?
      </label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        maxLength={500}
        placeholder="e.g. After the May 4 threshold change…"
        className="w-full rounded-md border border-amber-300 bg-background px-2 py-1 text-xs"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={pending}
          onClick={submit}
        >
          {pending ? "Rescoring…" : "Rescore now"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => {
            setConfirmOpen(false);
            setReason("");
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
