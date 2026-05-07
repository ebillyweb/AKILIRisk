"use client";

/**
 * §4.5 commit 3 (BRD §4.5) — advisor edit-draft form. Single-page form
 * with executive summary textarea, per-recommendation note textareas,
 * template radio, and three buttons: Save Draft, Preview, Publish.
 *
 * Server-side validation lives in `report-actions.ts`; this component
 * only does soft client-side guards (length counters) so a malformed
 * submission still 400s structurally rather than corrupting state.
 *
 * "Publish" calls publishReport(). On success, the page navigates to
 * the report list — that's where the new PUBLISHED row + freshly-opened
 * DRAFT shows up, plus the download button. Concurrent-publish errors
 * (P2002 surfaced as `concurrent_publish` from the action) toast +
 * stay on the edit page so the advisor can refresh.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2, Save, Send, FileDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { saveDraftEdits, publishReport } from "@/lib/actions/report-actions";

const EXECUTIVE_SUMMARY_MAX = 2000;
const ADVISOR_NOTE_MAX = 1000;

export interface EditDraftFormProps {
  clientId: string;
  draft: {
    id: string;
    version: number;
    templateChoice: "BELVEDERE" | "COBRANDED";
    executiveSummary: string | null;
  };
  recommendations: Array<{
    serviceRecommendationId: string;
    name: string;
    category: string;
    description: string;
    priority: number;
    notes: string;
  }>;
}

export function EditDraftForm({
  clientId,
  draft,
  recommendations,
}: EditDraftFormProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [executiveSummary, setExecutiveSummary] = useState(
    draft.executiveSummary ?? ""
  );
  const [templateChoice, setTemplateChoice] = useState<
    "BELVEDERE" | "COBRANDED"
  >(draft.templateChoice);
  const [notes, setNotes] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (const r of recommendations) {
      seed[r.serviceRecommendationId] = r.notes;
    }
    return seed;
  });
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const handleSave = async (): Promise<boolean> => {
    setSaving(true);
    try {
      const result = await saveDraftEdits({
        reportId: draft.id,
        executiveSummary: executiveSummary.length > 0 ? executiveSummary : null,
        advisorNotes: notes,
        templateChoice,
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
      const result = await publishReport(draft.id);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(`Published v${result.data.version}`);
      startTransition(() => {
        router.push(`/advisor/pipeline/${clientId}/report`);
        router.refresh();
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to publish");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Editing Draft
            <Badge variant="outline" className="font-mono">
              v{draft.version}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Template</Label>
            <div className="flex items-center gap-4">
              {(["COBRANDED", "BELVEDERE"] as const).map((choice) => (
                <label
                  key={choice}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <input
                    type="radio"
                    name="templateChoice"
                    value={choice}
                    checked={templateChoice === choice}
                    onChange={() => setTemplateChoice(choice)}
                  />
                  {choice === "COBRANDED"
                    ? "Co-branded (advisor logo + firm name)"
                    : "Belvedere only"}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="executiveSummary">Executive Summary</Label>
              <span
                className={`text-xs ${
                  executiveSummary.length > EXECUTIVE_SUMMARY_MAX
                    ? "text-destructive"
                    : "text-muted-foreground"
                }`}
              >
                {executiveSummary.length} / {EXECUTIVE_SUMMARY_MAX}
              </span>
            </div>
            <Textarea
              id="executiveSummary"
              value={executiveSummary}
              onChange={(e) => setExecutiveSummary(e.target.value)}
              placeholder="Optional advisor-authored summary that overrides the canned risk-level prose on the Executive Summary page."
              rows={6}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Per-Recommendation Notes</CardTitle>
        </CardHeader>
        <CardContent>
          {recommendations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No recommendations to annotate. The recommendations engine
              produces these from scoring rules — re-score the assessment if
              you expect notes here.
            </p>
          ) : (
            <ul className="space-y-5">
              {recommendations.map((r) => {
                const value = notes[r.serviceRecommendationId] ?? "";
                return (
                  <li
                    key={r.serviceRecommendationId}
                    className="space-y-2 border-l-2 border-muted pl-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{r.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.category} · priority {r.priority}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {r.description}
                        </p>
                      </div>
                      <span
                        className={`text-xs whitespace-nowrap ${
                          value.length > ADVISOR_NOTE_MAX
                            ? "text-destructive"
                            : "text-muted-foreground"
                        }`}
                      >
                        {value.length} / {ADVISOR_NOTE_MAX}
                      </span>
                    </div>
                    <Textarea
                      value={value}
                      onChange={(e) =>
                        setNotes((prev) => ({
                          ...prev,
                          [r.serviceRecommendationId]: e.target.value,
                        }))
                      }
                      rows={3}
                      placeholder="Advisor commentary surfaced beneath this recommendation in the PDF."
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

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
            href={`/api/reports/by-id/${draft.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <FileDown className="w-4 h-4 mr-2" />
            Preview
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
