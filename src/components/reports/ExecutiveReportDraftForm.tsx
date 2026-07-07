"use client";

/**
 * Phase 25: Advisor draft form for executive reports.
 *
 * Client component. Handles advisor notes, meeting agenda, discussion
 * prompts, reporting period presets, and publish flow.
 *
 * Period preset change calls generateExecutiveReport server action with
 * new periodStart/periodEnd. The server returns the existing or freshly
 * created DRAFT id, and the page refreshes to reload form state.
 *
 * Publish saves first (to pick up unsaved edits) then calls
 * publishExecutiveReport. On success navigates to the list page.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, subDays, subMonths } from "date-fns";
import toast from "react-hot-toast";
import {
  Loader2,
  Save,
  Send,
  FileDown,
  Plus,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  generateExecutiveReport,
  saveExecutiveDraftEdits,
  publishExecutiveReport,
} from "@/lib/actions/executive-report-actions";

const ADVISOR_NOTES_MAX = 2000;
const MEETING_AGENDA_MAX = 2000;
const DISCUSSION_PROMPT_MAX = 500;
const DISCUSSION_PROMPTS_MAX_COUNT = 10;

type PeriodPreset =
  | "last_90_days"
  | "last_6_months"
  | "last_12_months"
  | "all_time"
  | "custom";

interface DraftData {
  id: string;
  version: number;
  status: string;
  advisorNotes: string | null;
  meetingAgenda: string | null;
  discussionPrompts: string[];
  reportingPeriodStart: Date;
  reportingPeriodEnd: Date;
  clientId: string;
  advisorProfileId: string;
}

interface Props {
  draft: DraftData;
  clientId: string;
}

function computePresetDates(preset: PeriodPreset): {
  periodStart: string;
  periodEnd: string;
} {
  const now = new Date();
  const periodEnd = now.toISOString();
  switch (preset) {
    case "last_90_days":
      return { periodStart: subDays(now, 90).toISOString(), periodEnd };
    case "last_6_months":
      return { periodStart: subMonths(now, 6).toISOString(), periodEnd };
    case "last_12_months":
      return { periodStart: subMonths(now, 12).toISOString(), periodEnd };
    case "all_time":
      // Server will default to earliest assessment; send epoch as signal.
      return { periodStart: new Date(0).toISOString(), periodEnd };
    default:
      return { periodStart: new Date(0).toISOString(), periodEnd };
  }
}

export function ExecutiveReportDraftForm({ draft, clientId }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [advisorNotes, setAdvisorNotes] = useState(draft.advisorNotes ?? "");
  const [meetingAgenda, setMeetingAgenda] = useState(draft.meetingAgenda ?? "");
  const [discussionPrompts, setDiscussionPrompts] = useState<string[]>(
    draft.discussionPrompts.length > 0 ? draft.discussionPrompts : []
  );
  const [selectedPreset, setSelectedPreset] = useState<PeriodPreset>("custom");
  const [customStart, setCustomStart] = useState(
    format(draft.reportingPeriodStart, "yyyy-MM-dd")
  );
  const [customEnd, setCustomEnd] = useState(
    format(draft.reportingPeriodEnd, "yyyy-MM-dd")
  );
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [changingPeriod, setChangingPeriod] = useState(false);

  // ---------------------------------------------------------------------------
  // Period change
  // ---------------------------------------------------------------------------

  const handlePresetChange = async (preset: PeriodPreset) => {
    setSelectedPreset(preset);
    if (preset === "custom") return; // Wait for manual Apply click.

    setChangingPeriod(true);
    try {
      const dates = computePresetDates(preset);
      const result = await generateExecutiveReport({
        clientId,
        periodStart: dates.periodStart,
        periodEnd: dates.periodEnd,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to update reporting period");
    } finally {
      setChangingPeriod(false);
    }
  };

  const handleCustomPeriodApply = async () => {
    setChangingPeriod(true);
    try {
      const result = await generateExecutiveReport({
        clientId,
        periodStart: new Date(customStart).toISOString(),
        periodEnd: new Date(customEnd).toISOString(),
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to update reporting period");
    } finally {
      setChangingPeriod(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Save / Publish
  // ---------------------------------------------------------------------------

  const handleSave = async (): Promise<boolean> => {
    setSaving(true);
    try {
      const result = await saveExecutiveDraftEdits({
        reportId: draft.id,
        advisorNotes: advisorNotes || undefined,
        meetingAgenda: meetingAgenda || undefined,
        discussionPrompts: discussionPrompts.filter((p) => p.trim().length > 0),
      });
      if (!result.ok) {
        toast.error(result.message);
        return false;
      }
      toast.success("Draft saved");
      return true;
    } catch (err) {
      console.error(err);
      toast.error("Failed to save draft");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    // Save first so the publish snapshot picks up unsaved edits.
    const ok = await handleSave();
    if (!ok) return;

    setPublishing(true);
    try {
      const result = await publishExecutiveReport(draft.id);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(`Executive report v${result.data.version} published`);
      startTransition(() => {
        router.push(`/advisor/pipeline/${clientId}/executive-report`);
        router.refresh();
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to publish executive report");
    } finally {
      setPublishing(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Discussion prompts
  // ---------------------------------------------------------------------------

  const addPrompt = () => {
    if (discussionPrompts.length >= DISCUSSION_PROMPTS_MAX_COUNT) {
      toast.error(`Maximum ${DISCUSSION_PROMPTS_MAX_COUNT} discussion prompts allowed`);
      return;
    }
    setDiscussionPrompts((prev) => [...prev, ""]);
  };

  const updatePrompt = (index: number, value: string) => {
    setDiscussionPrompts((prev) =>
      prev.map((p, i) => (i === index ? value : p))
    );
  };

  const removePrompt = (index: number) => {
    setDiscussionPrompts((prev) => prev.filter((_, i) => i !== index));
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Reporting Period */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Reporting Period
            <Badge variant="outline" className="font-normal text-xs">
              D-24: displayed in report header
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Current period:{" "}
            <span className="font-medium text-foreground">
              {format(draft.reportingPeriodStart, "MMM d, yyyy")} &ndash;{" "}
              {format(draft.reportingPeriodEnd, "MMM d, yyyy")}
            </span>
          </p>
          <div>
            <Label className="mb-2 block">Change period</Label>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { preset: "last_90_days" as const, label: "Last 90 Days" },
                  { preset: "last_6_months" as const, label: "Last 6 Months" },
                  { preset: "last_12_months" as const, label: "Last 12 Months" },
                  { preset: "all_time" as const, label: "Since First Assessment" },
                  { preset: "custom" as const, label: "Custom Range" },
                ] as const
              ).map(({ preset, label }) => (
                <Button
                  key={preset}
                  variant={selectedPreset === preset ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePresetChange(preset)}
                  disabled={changingPeriod}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
          {selectedPreset === "custom" && (
            <div className="flex items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="customStart">Start date</Label>
                <input
                  id="customStart"
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="customEnd">End date</Label>
                <input
                  id="customEnd"
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                />
              </div>
              <Button
                size="sm"
                onClick={handleCustomPeriodApply}
                disabled={changingPeriod}
              >
                {changingPeriod ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Apply
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Editing Draft */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Editing Draft
            <Badge variant="outline" className="font-mono">
              v{draft.version}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Advisor Notes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="advisorNotes">Advisor Notes</Label>
              <span
                className={`text-xs ${
                  advisorNotes.length > ADVISOR_NOTES_MAX
                    ? "text-destructive"
                    : "text-muted-foreground"
                }`}
              >
                {advisorNotes.length} / {ADVISOR_NOTES_MAX}
              </span>
            </div>
            <Textarea
              id="advisorNotes"
              value={advisorNotes}
              onChange={(e) => setAdvisorNotes(e.target.value)}
              placeholder="Internal advisor commentary included in the Advisor Brief (not visible to client)."
              rows={5}
            />
          </div>

          {/* Meeting Agenda */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="meetingAgenda">Meeting Agenda</Label>
              <span
                className={`text-xs ${
                  meetingAgenda.length > MEETING_AGENDA_MAX
                    ? "text-destructive"
                    : "text-muted-foreground"
                }`}
              >
                {meetingAgenda.length} / {MEETING_AGENDA_MAX}
              </span>
            </div>
            <Textarea
              id="meetingAgenda"
              value={meetingAgenda}
              onChange={(e) => setMeetingAgenda(e.target.value)}
              placeholder="Key topics to cover in the client meeting. Appears in the Advisor Brief."
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* Discussion Prompts */}
      <Card>
        <CardHeader>
          <CardTitle>Discussion Prompts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {discussionPrompts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No discussion prompts yet. Add prompts to guide the client meeting conversation.
            </p>
          ) : (
            <ol className="space-y-3">
              {discussionPrompts.map((prompt, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-2 text-sm text-muted-foreground font-mono min-w-[1.5rem]">
                    {i + 1}.
                  </span>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs ${
                          prompt.length > DISCUSSION_PROMPT_MAX
                            ? "text-destructive"
                            : "text-muted-foreground"
                        }`}
                      >
                        {prompt.length} / {DISCUSSION_PROMPT_MAX}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={prompt}
                        onChange={(e) => updatePrompt(i, e.target.value)}
                        placeholder={`Discussion prompt ${i + 1}`}
                        className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removePrompt(i)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={addPrompt}
            disabled={discussionPrompts.length >= DISCUSSION_PROMPTS_MAX_COUNT}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Prompt
            {discussionPrompts.length > 0 && (
              <span className="ml-2 text-xs text-muted-foreground">
                ({discussionPrompts.length}/{DISCUSSION_PROMPTS_MAX_COUNT})
              </span>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleSave} disabled={saving || publishing}>
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save Draft
        </Button>
        <Button asChild variant="outline">
          <a
            href={`/api/reports/executive/${draft.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <FileDown className="w-4 h-4 mr-2" />
            Preview Executive Report
          </a>
        </Button>
        <Button asChild variant="outline">
          <a
            href={`/api/reports/executive/${draft.id}/pdf?variant=advisor`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <FileDown className="w-4 h-4 mr-2" />
            Preview Advisor Brief
          </a>
        </Button>
        <Button
          onClick={handlePublish}
          disabled={saving || publishing}
          variant="default"
        >
          {publishing ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Send className="w-4 h-4 mr-2" />
          )}
          Publish v{draft.version}
        </Button>
      </div>
    </div>
  );
}
