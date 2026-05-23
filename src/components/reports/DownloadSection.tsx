"use client";

/**
 * DownloadSection Component
 *
 * Client-facing PDF download — only available after the advisor publishes.
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

interface DownloadSectionProps {
  assessmentId: string;
}

export function DownloadSection({ assessmentId }: DownloadSectionProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasPublished, setHasPublished] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/reports/${assessmentId}/availability`);
        if (!res.ok) {
          if (!cancelled) setHasPublished(false);
          return;
        }
        const data = (await res.json()) as { hasPublished: boolean };
        if (!cancelled) setHasPublished(data.hasPublished);
      } catch {
        if (!cancelled) setHasPublished(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assessmentId]);

  const downloadPDFReport = async () => {
    try {
      setIsGenerating(true);

      const response = await fetch(`/api/reports/${assessmentId}/pdf`);

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ||
            `Failed to generate report: ${response.statusText}`
        );
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `risk-assessment-report-${assessmentId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success("Report downloaded successfully");
    } catch (error) {
      console.error("Error downloading PDF report:", error);
      toast.error(error instanceof Error ? error.message : "Failed to download report");
    } finally {
      setIsGenerating(false);
    }
  };

  if (hasPublished === null) {
    return (
      <div className="space-y-4">
        <p className="editorial-kicker">Download Your Report</p>
        <p className="text-sm text-muted-foreground">Checking report availability…</p>
      </div>
    );
  }

  if (!hasPublished) {
    return (
      <div className="space-y-4">
        <p className="editorial-kicker">Download Your Report</p>
        <p className="text-sm text-muted-foreground">
          Your advisor will publish a finalized report when their review is complete.
          You will be able to download it here once it is published.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="editorial-kicker">Download Your Report</p>

      <div className="space-y-3">
        <Button
          onClick={downloadPDFReport}
          disabled={isGenerating}
          size="lg"
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating Report...
            </>
          ) : (
            <>
              <FileDown className="w-4 h-4 mr-2" />
              Download PDF Report
            </>
          )}
        </Button>

        <p className="text-sm text-muted-foreground">
          Co-branded PDF with executive summary, pillar scores, and recommendations
        </p>
      </div>
    </div>
  );
}
