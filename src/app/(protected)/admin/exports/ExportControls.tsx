"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NO_ADVISOR = "__none__";

interface AdvisorOption {
  advisorProfileId: string;
  label: string;
  email: string;
}

interface ExportControlsProps {
  advisorOptions: AdvisorOption[];
  /** When true, render the system-wide button instead of the advisor picker. */
  systemOnly?: boolean;
}

/**
 * Client form for the data export buttons. Uses an `<a download>` to start
 * the streaming download (the route returns a ZIP with
 * Content-Disposition: attachment, so the browser handles the rest).
 *
 * For the system-wide case we add a confirmation dialog because the
 * payload can be very large and trigger the 50-MB cap. The cap-exceeded
 * case shows up to the user as a truncated download (the route errors
 * the stream mid-flight); the `[export] aborted` line in the server log
 * is the operational signal.
 */
export function ExportControls({ advisorOptions, systemOnly }: ExportControlsProps) {
  const [advisorProfileId, setAdvisorProfileId] = useState<string>("");
  const [systemConfirmOpen, setSystemConfirmOpen] = useState(false);

  if (systemOnly) {
    return (
      <div className="space-y-3">
        {!systemConfirmOpen ? (
          <Button
            type="button"
            variant="default"
            onClick={() => setSystemConfirmOpen(true)}
          >
            <Download className="h-4 w-4 mr-2" />
            Download system-wide export
          </Button>
        ) : (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-4 space-y-3">
            <p className="text-sm text-amber-900">
              System-wide exports include every tenant. The download is
              capped at 50&nbsp;MB and may truncate for large platforms.
              Continue?
            </p>
            <div className="flex gap-2">
              <Button asChild variant="default">
                <a
                  href="/api/admin/exports?scope=system"
                  download
                  onClick={() => setSystemConfirmOpen(false)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </a>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSystemConfirmOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const downloadHref = advisorProfileId
    ? `/api/admin/exports?scope=tenant&advisorProfileId=${encodeURIComponent(advisorProfileId)}`
    : "#";

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium" htmlFor="export-advisor">
        Advisor
      </label>
      <Select
        value={advisorProfileId === "" ? NO_ADVISOR : advisorProfileId}
        onValueChange={(v) => setAdvisorProfileId(v === NO_ADVISOR ? "" : v)}
      >
        <SelectTrigger id="export-advisor" className="w-full">
          <SelectValue placeholder="— select an advisor —" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_ADVISOR}>— select an advisor —</SelectItem>
          {advisorOptions.map((opt) => (
            <SelectItem key={opt.advisorProfileId} value={opt.advisorProfileId}>
              {opt.label} ({opt.email})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button asChild variant="default" disabled={!advisorProfileId}>
        <a
          href={downloadHref}
          download
          aria-disabled={!advisorProfileId}
          onClick={(e) => {
            if (!advisorProfileId) e.preventDefault();
          }}
        >
          <Download className="h-4 w-4 mr-2" />
          Download tenant export
        </a>
      </Button>
    </div>
  );
}
