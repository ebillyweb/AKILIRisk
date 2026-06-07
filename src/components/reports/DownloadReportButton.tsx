"use client";

/**
 * Advisor + admin "Download client report" button.
 *
 * §4.5 commit 2. Mirrors `DownloadSection` (the client's own self-download
 * widget) but is intended for advisor + admin call sites — slimmer chrome,
 * the label is parameterised, and the filename is keyed off the client id
 * the caller supplies so multiple downloads from the same advisor session
 * land on disk under distinguishable names.
 *
 * Auth gating happens server-side at `/api/reports/[id]/pdf`. This button
 * is just a UI affordance; rendering it does NOT confer access. The route
 * verifies (owner | active-assigned-advisor | admin) and returns 403 to
 * anyone else.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

interface DownloadReportButtonProps {
  /** Assessment id — passed straight to the route as `[id]`. */
  assessmentId: string;
  /** Used in the suggested filename (e.g. client name or email slug). When
   *  unset, falls back to the assessment id so downloads still distinguish. */
  clientLabel?: string;
  /** Optional override for the button label (defaults to "Download client
   *  report"). Useful for admin contexts where "client" is implicit. */
  label?: string;
  /** Optional shadcn-button variant override. */
  variant?: "default" | "outline" | "secondary" | "ghost" | "link";
  /** Optional shadcn-button size override. */
  size?: "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg";
  /** When true, button stretches to its container width. */
  fullWidth?: boolean;
}

export function DownloadReportButton({
  assessmentId,
  clientLabel,
  label = "Download client report",
  variant = "outline",
  size = "default",
  fullWidth = false,
}: DownloadReportButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const slug = (clientLabel || assessmentId)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const downloadPDFReport = async () => {
    try {
      setIsGenerating(true);

      const response = await fetch(`/api/reports/${assessmentId}/pdf`);

      if (!response.ok) {
        // 403 surfaces here when the caller isn't the owner / assigned
        // advisor / admin — render a useful toast instead of swallowing.
        let detail = response.statusText;
        try {
          const body = await response.json();
          if (body?.error) detail = body.error;
        } catch {
          // Non-JSON body; keep statusText.
        }
        throw new Error(`Failed to generate report: ${detail}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `family-governance-report-${slug}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success("Report downloaded");
    } catch (error) {
      console.error("Error downloading PDF report:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to download report"
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      onClick={downloadPDFReport}
      disabled={isGenerating}
      variant={variant}
      size={size}
      className={fullWidth ? "w-full justify-start" : undefined}
    >
      {isGenerating ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Generating…
        </>
      ) : (
        <>
          <FileDown className="w-4 h-4 mr-2" />
          {label}
        </>
      )}
    </Button>
  );
}
