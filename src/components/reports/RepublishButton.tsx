"use client";

/**
 * §4.5 commit 3 (BRD §4.5) — admin Republish button. Opens an inline
 * reason form (textarea + 500-char counter), posts the reason to
 * `republishReport`, refreshes on success.
 *
 * Use case: a scoring bug shipped, the resulting PUBLISHED report has
 * wrong numbers; the admin republishes to refresh the snapshot. The old
 * row is preserved as SUPERSEDED with its frozen incorrect numbers — the
 * admin's reason captured in audit makes the cause auditable.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { republishReport } from "@/lib/actions/report-actions";

const REASON_MAX = 500;

export function RepublishButton({
  assessmentId,
  currentVersion,
}: {
  assessmentId: string;
  currentVersion: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [running, setRunning] = useState(false);

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        title={`Supersede v${currentVersion} with a fresh snapshot`}
      >
        <RefreshCcw className="w-4 h-4 mr-2" />
        Republish
      </Button>
    );
  }

  const handleSubmit = async () => {
    if (reason.trim().length === 0) {
      toast.error("A reason is required.");
      return;
    }
    setRunning(true);
    try {
      const result = await republishReport({ assessmentId, reason });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(`Republished as v${result.data.version}`);
      setOpen(false);
      setReason("");
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error("Failed to republish");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-2 rounded-md border border-border p-3 bg-muted/40">
      <div className="flex items-center justify-between">
        <Label htmlFor="republish-reason" className="text-xs font-medium">
          Republish reason (required, captured in audit log)
        </Label>
        <span
          className={`text-xs ${
            reason.length > REASON_MAX ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          {reason.length} / {REASON_MAX}
        </span>
      </div>
      <Textarea
        id="republish-reason"
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="e.g. Scoring rule v2 corrected MFA weighting bug — refresh the report to surface the corrected pillar score."
      />
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={running || reason.trim().length === 0}
        >
          {running ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCcw className="w-4 h-4 mr-2" />
          )}
          Republish v{currentVersion + 1}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setReason("");
          }}
          disabled={running}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
