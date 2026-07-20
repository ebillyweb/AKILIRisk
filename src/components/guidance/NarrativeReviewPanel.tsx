"use client";

import { useState, useTransition } from "react";
import { Sparkles, Check, Pencil, X, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  updateRecommendationNarrative,
  setNarrativeApproval,
} from "@/lib/actions/guidance-actions";
import type { GuidancePackageItem } from "@/lib/recommendations/types";

type Props = { item: GuidancePackageItem };

/**
 * Advisor review surface for an AI-drafted recommendation narrative.
 * Shows the generated copy with an AI-assisted badge, lets the advisor edit it,
 * and approve/un-approve it. Only approved narratives are shown to the client.
 * Renders nothing when no narrative was generated.
 */
export function NarrativeReviewPanel({ item }: Props) {
  const narrative = item.aiNarrative;
  const [approved, setApproved] = useState(item.aiNarrativeReview?.status === "approved");
  const [edited, setEdited] = useState(item.aiNarrativeReview?.edited ?? false);
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [headline, setHeadline] = useState(narrative?.headline ?? "");
  const [rationale, setRationale] = useState(narrative?.rationale ?? "");
  const [actionsText, setActionsText] = useState((narrative?.tailoredActions ?? []).join("\n"));

  // Display values reflect the last saved edit.
  const [displayHeadline, setDisplayHeadline] = useState(narrative?.headline ?? "");
  const [displayRationale, setDisplayRationale] = useState(narrative?.rationale ?? "");
  const [displayActions, setDisplayActions] = useState<string[]>(narrative?.tailoredActions ?? []);

  if (!narrative) return null;

  function handleSave() {
    const tailoredActions = actionsText
      .split("\n")
      .map((a) => a.trim())
      .filter(Boolean);
    startTransition(async () => {
      const res = await updateRecommendationNarrative({
        recommendationId: item.id,
        headline,
        rationale,
        tailoredActions,
      });
      if (res.success) {
        setDisplayHeadline(headline);
        setDisplayRationale(rationale);
        setDisplayActions(tailoredActions);
        setEdited(true);
        setEditing(false);
      }
    });
  }

  function handleCancel() {
    setHeadline(displayHeadline);
    setRationale(displayRationale);
    setActionsText(displayActions.join("\n"));
    setEditing(false);
  }

  function toggleApproval() {
    const next = !approved;
    startTransition(async () => {
      setApproved(next);
      const res = await setNarrativeApproval({ recommendationId: item.id, approved: next });
      if (!res.success) setApproved(!next); // revert on failure
    });
  }

  return (
    <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-500" aria-hidden />
          <span className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
            AI-assisted rationale
          </span>
          <Badge variant={approved ? "success" : "outline"}>
            {approved ? "Approved — visible to client" : "Pending review"}
          </Badge>
          {edited && <Badge variant="secondary">Edited</Badge>}
        </div>
        {!editing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditing(true)}
            disabled={isPending}
            aria-label="Edit narrative"
          >
            <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
          </Button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <Input
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="Headline"
            aria-label="Headline"
          />
          <Textarea
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            rows={4}
            placeholder="Rationale"
            aria-label="Rationale"
          />
          <Textarea
            value={actionsText}
            onChange={(e) => setActionsText(e.target.value)}
            rows={4}
            placeholder="One action per line"
            aria-label="Tailored actions, one per line"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={isPending}>
              <Check className="mr-1 h-3.5 w-3.5" /> Save
            </Button>
            <Button size="sm" variant="ghost" onClick={handleCancel} disabled={isPending}>
              <X className="mr-1 h-3.5 w-3.5" /> Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-900">{displayHeadline}</p>
          <p className="text-sm text-gray-700">{displayRationale}</p>
          {displayActions.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-5 text-sm text-gray-700">
              {displayActions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          )}
          <div className="pt-1">
            <Button
              size="sm"
              variant={approved ? "outline" : "default"}
              onClick={toggleApproval}
              disabled={isPending}
            >
              {approved ? (
                <>
                  <Undo2 className="mr-1 h-3.5 w-3.5" /> Un-approve
                </>
              ) : (
                <>
                  <Check className="mr-1 h-3.5 w-3.5" /> Approve for client
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
